"""
Booking logs (api/features/booking/logs.py, BookingLog): every step of a booking is written as it
happens and returned, oldest first, in booking/history/ ("logs" on BookingHistorySerializer).

Driver websocket actions are called through the sync functions behind the consumer's
@database_sync_to_async methods (as in OfferFlowTest). Broadcasts are mocked; on-commit work runs
with captureOnCommitCallbacks(execute=True).
"""
from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.features.booking.logs import log_booking_event
from api.features.booking.models import Booking, BookingLog, Rate
from api.features.booking.utils import assign_driver_sync
from api.features.notifications.triggers import notify_if_driver_nearby
from websocket.features.driver import DriverConsumer

from .factories import (
    DROPOFF, PICKUP, idem, make_booking, make_driver, make_passenger, make_station, make_toda, offset, queue_driver,
)

accept = DriverConsumer.__dict__["accept_booking"].func
decline = DriverConsumer.__dict__["decline_booking"].func
expire = DriverConsumer.__dict__["booking_expired"].func

NEAR = {"latitude": PICKUP["lat"], "longitude": PICKUP["lng"]}


def consumer_for(driver):
    consumer = DriverConsumer()
    consumer.driver = driver
    consumer.user = driver.user
    return consumer


def events(booking):
    return list(BookingLog.objects.filter(booking=booking).values_list("event", flat=True))


class LogTestBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.toda = make_toda()
        self.station = make_station(self.toda)
        self.passenger = make_passenger()
        self.driver = make_driver(self.toda, self.station)
        for target in (
            "api.features.booking.signals.broadcast",
            "api.features.booking.helpers.offer_driver.broadcast",
            "api.features.booking.helpers.booking_error.broadcast",
            "websocket.features.driver.broadcast",
        ):
            patcher = mock.patch(target, create=True)
            patcher.start()
            self.addCleanup(patcher.stop)
        # the real assignment thread would race the test; tests call assign_driver_sync themselves
        patcher = mock.patch("api.features.booking.signals._run_assignment")
        patcher.start()
        self.addCleanup(patcher.stop)

    def on_commit(self, fn, *args, **kwargs):
        with self.captureOnCommitCallbacks(execute=True):
            return fn(*args, **kwargs)

    def history(self, user):
        self.client.force_authenticate(user)
        res = self.client.get(reverse("booking-history"))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        return res.data

    def book(self):
        self.client.force_authenticate(self.passenger.user)
        res = self.on_commit(
            self.client.post,
            reverse("booking-list"),
            {"start": PICKUP, "start_address": "Malolos Cathedral", "end": DROPOFF, "end_address": "Robinsons Malolos",
             "stops": [], "type": "regular"},
            format="json", **idem(),
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return Booking.objects.get(id=res.data["id"])

    def put_status(self, booking, value, location=None):
        self.client.force_authenticate(self.driver.user)
        body = {"status": value, **({"location": location} if location else {})}
        return self.on_commit(self.client.put, reverse("booking-detail", args=[booking.id]), body, format="json", **idem())

    def rate(self, user, booking, rated_user, score):
        self.client.force_authenticate(user)
        return self.client.post(
            reverse("rate"), {"booking_id": booking.id, "user_id": rated_user.id, "score": score}, format="json"
        )


class BookingJourneyLogTests(LogTestBase):
    def test_a_whole_ride_is_logged_in_order_and_shown_in_both_histories(self):
        other = make_driver(self.toda, self.station)  # nearest: gets the first offer, then declines
        queue_driver(other, PICKUP)
        queue_driver(self.driver, offset(PICKUP, 300))

        booking = self.book()
        self.on_commit(assign_driver_sync, booking.id)                                # offered to `other`
        self.assertTrue(self.on_commit(decline, consumer_for(other), booking.id, NEAR))  # declined -> offered again
        data = self.on_commit(accept, consumer_for(self.driver), booking.id)
        self.assertEqual(data["status"], "accepted")
        notify_if_driver_nearby(booking.id, PICKUP["lat"], PICKUP["lng"])
        self.assertEqual(self.put_status(booking, "in_progress", NEAR).status_code, 200)
        self.assertEqual(self.put_status(booking, "completed").status_code, 200)
        self.assertEqual(self.rate(self.passenger.user, booking, self.driver.user, 5).status_code, 201)
        self.assertEqual(self.rate(self.driver.user, booking, self.passenger.user, 1).status_code, 201)

        expected = [
            ("requested", "Ride requested: Malolos Cathedral → Robinsons Malolos (₱"),
            ("offered", "Offered to a nearby driver."),
            ("offer_declined", "A driver declined. Looking for another driver."),
            ("offered", "Offered to a nearby driver."),
            ("accepted", "Accepted by "),
            ("driver_nearby", "The driver arrived near the pickup point."),
            ("picked_up", "Passenger picked up."),
            ("completed", "Ride completed."),
            ("rated", "The passenger rated the driver 5 stars."),
            ("rated", "The driver rated the passenger 1 star."),
        ]
        for user in (self.passenger.user, self.driver.user):
            with self.subTest(viewer=user.username):
                (ride,) = self.history(user)
                logs = ride["logs"]
                self.assertEqual([(l["event"], l["message"][: len(m)]) for l, (_, m) in zip(logs, expected)], expected)
                self.assertEqual(len(logs), len(expected))
                self.assertEqual(set(logs[0]), {"id", "event", "message", "created_at"})
                times = [l["created_at"] for l in logs]
                self.assertEqual(times, sorted(times))

        accepted = BookingLog.objects.get(booking=booking, event="accepted")
        self.assertIn(self.driver.vehicle_plate, accepted.message)
        self.assertEqual(accepted.actor, self.driver.user)

    def test_offers_never_name_the_drivers_who_did_not_take_the_ride(self):
        other = make_driver(self.toda, self.station)
        other.user.first_name, other.user.last_name = "Juan", "Delacruz"
        other.user.save()
        queue_driver(other, PICKUP)
        queue_driver(self.driver, offset(PICKUP, 300))
        booking = self.book()
        self.on_commit(assign_driver_sync, booking.id)
        self.on_commit(decline, consumer_for(other), booking.id, NEAR)
        self.on_commit(accept, consumer_for(self.driver), booking.id)
        text = " ".join(BookingLog.objects.filter(booking=booking).values_list("message", flat=True))
        self.assertNotIn("Juan", text)
        self.assertNotIn(other.user.username, text)
        self.assertNotIn(other.vehicle_plate, text)


class EventLogTests(LogTestBase):
    def test_booking_request_is_logged_with_route_price_and_passenger(self):
        booking = self.book()
        (log,) = BookingLog.objects.filter(booking=booking)
        self.assertEqual(log.event, "requested")
        self.assertEqual(log.message, f"Ride requested: Malolos Cathedral → Robinsons Malolos (₱{booking.price}).")
        self.assertEqual(log.actor, self.passenger.user)

    def test_offer_timeout_is_logged(self):
        other = make_driver(self.toda, self.station)
        queue_driver(other, PICKUP)
        queue_driver(self.driver, offset(PICKUP, 300))
        booking = self.book()
        self.on_commit(assign_driver_sync, booking.id)
        self.on_commit(expire, consumer_for(other), booking.id)
        self.assertEqual(events(booking), ["requested", "offered", "offer_expired", "offered"])
        self.assertEqual(
            BookingLog.objects.get(booking=booking, event="offer_expired").message,
            "A driver didn't answer in time. Looking for another driver.",
        )

    def test_failed_accept_writes_nothing(self):
        booking = self.book()  # never offered to this driver
        data = self.on_commit(accept, consumer_for(self.driver), booking.id)
        self.assertFalse(data["success"])
        self.assertEqual(events(booking), ["requested"])

    def test_refused_status_change_writes_nothing(self):
        booking = make_booking(self.passenger, self.driver, status=Booking.Status.ACCEPTED)
        self.assertEqual(self.put_status(booking, "completed").status_code, 400)  # must pick up first
        self.assertEqual(events(booking), [])

    def test_cancel_by_passenger_is_logged(self):
        booking = make_booking(self.passenger, self.driver, status=Booking.Status.ACCEPTED)
        self.client.force_authenticate(self.passenger.user)
        self.assertEqual(self.on_commit(self.client.post, reverse("booking-cancel", args=[booking.id])).status_code, 200)
        (log,) = BookingLog.objects.filter(booking=booking)
        self.assertEqual((log.event, log.message, log.actor), ("cancelled", "Cancelled by the passenger.", self.passenger.user))
        (ride,) = self.history(self.driver.user)
        self.assertEqual([l["event"] for l in ride["logs"]], ["cancelled"])

    def test_driver_nearby_is_logged_once(self):
        booking = make_booking(self.passenger, self.driver, status=Booking.Status.ACCEPTED)
        for _ in range(3):
            notify_if_driver_nearby(booking.id, PICKUP["lat"], PICKUP["lng"])
        self.assertEqual(events(booking), ["driver_nearby"])

    def test_driver_far_away_is_not_logged(self):
        booking = make_booking(self.passenger, self.driver, status=Booking.Status.ACCEPTED)
        far = offset(PICKUP, 2000)
        notify_if_driver_nearby(booking.id, far["lat"], far["lng"])
        self.assertEqual(events(booking), [])

    def test_incident_reports_are_not_logged(self):
        booking = make_booking(self.passenger, self.driver, status=Booking.Status.COMPLETED)
        self.client.force_authenticate(self.passenger.user)
        with mock.patch("api.features.reports.signals.get_channel_layer", return_value=None):
            res = self.client.post(
                reverse("incident-report-list-create"),
                {"booking_id": booking.id, "location": PICKUP, "incident_types": "accident",
                 "injured_party": "none", "details": "Bumped a car"},
                format="json", **idem(),
            )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(events(booking), [])
        for user in (self.passenger.user, self.driver.user):
            (ride,) = self.history(user)
            self.assertEqual(ride["logs"], [])

    def test_a_booking_without_logs_has_an_empty_list(self):
        make_booking(self.passenger, self.driver, status=Booking.Status.COMPLETED)
        (ride,) = self.history(self.passenger.user)
        self.assertEqual(ride["logs"], [])

    def test_history_shows_each_ride_its_own_logs(self):
        first = make_booking(self.passenger, self.driver, status=Booking.Status.COMPLETED)
        second = make_booking(self.passenger, self.driver, status=Booking.Status.COMPLETED)
        log_booking_event(first, "completed", "Ride completed.")
        log_booking_event(second, "cancelled", "Cancelled by the passenger.")
        by_id = {r["id"]: [l["event"] for l in r["logs"]] for r in self.history(self.passenger.user)}
        self.assertEqual(by_id, {first.id: ["completed"], second.id: ["cancelled"]})

    def test_history_logs_cost_one_query_however_many_rides(self):
        for _ in range(3):
            b = make_booking(self.passenger, self.driver, status=Booking.Status.COMPLETED)
            log_booking_event(b, "completed", "Ride completed.")
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        self.client.force_authenticate(self.passenger.user)
        with CaptureQueriesContext(connection) as three_rides:
            self.client.get(reverse("booking-history"))
        for _ in range(3):
            b = make_booking(self.passenger, self.driver, status=Booking.Status.COMPLETED)
            log_booking_event(b, "completed", "Ride completed.")
        # the logs are prefetched: six rides cost the same queries as three (no query per ride)
        with self.assertNumQueries(len(three_rides)):
            self.client.get(reverse("booking-history"))
        self.assertTrue(any("api_bookinglog" in q["sql"] for q in three_rides.captured_queries))


class LogWriteFailureTests(TestCase):
    def test_a_failed_log_write_never_breaks_the_booking_action(self):
        passenger = make_passenger()
        booking = make_booking(passenger, status=Booking.Status.COMPLETED)
        with mock.patch.object(BookingLog.objects, "create", side_effect=RuntimeError("db hiccup")), \
                self.assertLogs("api.features.booking.logs", level="ERROR"):
            self.assertIsNone(log_booking_event(booking, "completed", "Ride completed."))
        # the surrounding transaction is still usable
        booking.status = Booking.Status.CANCELLED
        booking.save()
        self.assertEqual(Booking.objects.get(id=booking.id).status, Booking.Status.CANCELLED)

    def test_long_messages_are_cut_to_fit(self):
        booking = make_booking(make_passenger(), status=Booking.Status.COMPLETED)
        log = log_booking_event(booking, "requested", "x" * 400)
        self.assertEqual(len(log.message), 255)
