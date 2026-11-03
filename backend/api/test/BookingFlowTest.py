"""Booking REST endpoints: create, list, detail, status transitions (incl. pickup proximity),
delete, driver queue, fare estimate, ratings, and driver assignment."""
from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.features.booking.helpers.pickup_proximity import (
    PICKUP_RADIUS_M, distance_to_pickup_m, get_driver_coords, is_near_pickup,
)
from api.features.booking.models import Booking, DriverQueue, Rate
from api.features.booking.utils import assign_driver_sync

from .factories import (
    DROPOFF, FAR_AWAY, PICKUP, idem, make_admin, make_booking, make_driver,
    make_passenger, make_station, make_toda, offset, queue_driver,
)

BOOKING_LIST = "booking-list"
BOOKING_DETAIL = "booking-detail"
QUEUE = "driver-queue"
DEQUEUE = "driver-dequeue"
QUEUE_STATUS = "driver-queue-status"
RATE = "rate"
FARE = "fare-price"


class BookingBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.toda = make_toda()
        self.station = make_station(self.toda)
        self.passenger = make_passenger()
        self.driver = make_driver(self.toda, self.station)

    def as_user(self, user):
        self.client.force_authenticate(user)

    def detail(self, booking):
        return reverse(BOOKING_DETAIL, args=[booking.id])


# ---------------------------------------------------------------------------
# Create / list / retrieve / delete
# ---------------------------------------------------------------------------
class BookingCreateTests(BookingBase):
    def payload(self, **overrides):
        data = {
            "start": PICKUP,
            "start_address": "Pickup",
            "end": DROPOFF,
            "end_address": "Dropoff",
            "stops": [],
            "type": "regular",
        }
        data.update(overrides)
        return data

    def test_passenger_creates_pending_booking_with_server_price(self):
        self.as_user(self.passenger.user)
        res = self.client.post(reverse(BOOKING_LIST), self.payload(price=1), format="json", **idem())

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["status"], "pending")
        self.assertEqual(res.data["start"], PICKUP)
        # the client-sent price is ignored: ~1.53 km → base fare 15 + 0.53 km × ₱10 ≈ 20
        self.assertEqual(res.data["price"], 20)
        self.assertEqual(Booking.objects.get(id=res.data["id"]).passenger, self.passenger)

    def test_anonymous_rejected(self):
        res = self.client.post(reverse(BOOKING_LIST), self.payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_driver_cannot_book(self):
        self.as_user(self.driver.user)
        res = self.client.post(reverse(BOOKING_LIST), self.payload(), format="json", **idem())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["error"], "User is not a passenger")

    def test_missing_start_or_end(self):
        self.as_user(self.passenger.user)
        res = self.client.post(reverse(BOOKING_LIST), self.payload(end=None), format="json", **idem())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("required", res.data["error"])

    def test_invalid_coordinates(self):
        self.as_user(self.passenger.user)
        res = self.client.post(
            reverse(BOOKING_LIST), self.payload(start={"lat": "abc"}), format="json", **idem()
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["error"], "Invalid start or end location")

    def test_pickup_outside_every_toda(self):
        self.as_user(self.passenger.user)
        res = self.client.post(reverse(BOOKING_LIST), self.payload(start=FAR_AWAY), format="json", **idem())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("outside", res.data["error"])

    def test_second_active_booking_rejected(self):
        make_booking(self.passenger, status=Booking.Status.PENDING)
        self.as_user(self.passenger.user)
        res = self.client.post(reverse(BOOKING_LIST), self.payload(), format="json", **idem())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already have", res.data["error"])


class BookingListRetrieveDeleteTests(BookingBase):
    def test_passenger_lists_only_own_bookings(self):
        mine = make_booking(self.passenger, self.driver)
        make_booking(make_passenger(), self.driver)
        self.as_user(self.passenger.user)

        res = self.client.get(reverse(BOOKING_LIST))

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([b["id"] for b in res.data["results"]], [mine.id])

    def test_driver_lists_assigned_bookings(self):
        assigned = make_booking(self.passenger, self.driver)
        make_booking(make_passenger(), make_driver(self.toda, self.station))
        self.as_user(self.driver.user)

        res = self.client.get(reverse(BOOKING_LIST))

        self.assertEqual([b["id"] for b in res.data["results"]], [assigned.id])

    def test_non_admin_cannot_filter_by_boundary(self):
        self.as_user(self.passenger.user)
        res = self.client.get(reverse(BOOKING_LIST), {"toda_boundary": self.toda.id})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_filters_by_boundary(self):
        booking = make_booking(self.passenger, self.driver)
        self.as_user(make_admin("TODA"))
        res = self.client.get(reverse(BOOKING_LIST), {"toda_boundary": self.toda.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([b["id"] for b in res.data["results"]], [booking.id])

    def test_passenger_retrieves_own_booking(self):
        booking = make_booking(self.passenger, self.driver)
        self.as_user(self.passenger.user)
        res = self.client.get(self.detail(booking))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["id"], booking.id)

    def test_other_passenger_gets_404(self):
        booking = make_booking(self.passenger, self.driver)
        self.as_user(make_passenger().user)
        res = self.client.get(self.detail(booking))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_pending_booking_can_be_deleted(self):
        booking = make_booking(self.passenger, status=Booking.Status.PENDING)
        self.as_user(self.passenger.user)
        res = self.client.delete(self.detail(booking), **idem())
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Booking.objects.filter(id=booking.id).exists())

    def test_accepted_booking_cannot_be_deleted(self):
        booking = make_booking(self.passenger, self.driver)
        self.as_user(self.passenger.user)
        res = self.client.delete(self.detail(booking), **idem())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Booking.objects.filter(id=booking.id).exists())


# ---------------------------------------------------------------------------
# Status transitions + pickup proximity
# ---------------------------------------------------------------------------
class BookingStatusTransitionTests(BookingBase):
    def setUp(self):
        super().setUp()
        self.booking = make_booking(self.passenger, self.driver)
        self.as_user(self.driver.user)

    def put(self, body):
        return self.client.put(self.detail(self.booking), body, format="json", **idem())

    def driver_at(self, coords):
        return {"latitude": coords["lat"], "longitude": coords["lng"]}

    def test_pickup_at_the_pickup_point(self):
        res = self.put({"status": "in_progress", "location": self.driver_at(PICKUP)})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["status"], "in_progress")
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.IN_PROGRESS)

    def test_pickup_just_inside_the_radius(self):
        res = self.put({"status": "in_progress", "location": self.driver_at(offset(PICKUP, PICKUP_RADIUS_M - 20))})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

    def test_pickup_outside_the_radius_rejected(self):
        res = self.put({"status": "in_progress", "location": self.driver_at(offset(PICKUP, 1000))})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("from the pickup point", res.data["error"])
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.ACCEPTED)

    def test_pickup_without_any_location_rejected(self):
        res = self.put({"status": "in_progress"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location is not available", res.data["error"])

    def test_pickup_with_malformed_location_rejected(self):
        res = self.put({"status": "in_progress", "location": {"latitude": "x", "longitude": 999}})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pickup_falls_back_to_socket_cached_location(self):
        cache.set(
            f"booking_{self.booking.id}_driver_location",
            {"coords": {"latitude": PICKUP["lat"], "longitude": PICKUP["lng"]}},
            20,
        )
        res = self.put({"status": "in_progress"})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

    def test_complete_after_pickup(self):
        self.booking.status = Booking.Status.IN_PROGRESS
        self.booking.save()
        res = self.put({"status": "completed"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "completed")

    def test_cannot_skip_pickup(self):
        res = self.put({"status": "completed"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot transition", res.data["error"])

    def test_repeating_pickup_is_rejected(self):
        """Regression: the stale 'Pick Up Passenger' button sent this twice."""
        self.put({"status": "in_progress", "location": self.driver_at(PICKUP)})
        res = self.put({"status": "in_progress", "location": self.driver_at(PICKUP)})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("'in_progress' to 'in_progress'", res.data["error"])

    def test_missing_status(self):
        res = self.put({})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["error"], "Status is required")

    def test_passenger_cannot_change_status(self):
        self.as_user(self.passenger.user)
        res = self.put({"status": "in_progress"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["error"], "User is not a driver")

    def test_other_driver_gets_404(self):
        self.as_user(make_driver(self.toda, self.station).user)
        res = self.put({"status": "in_progress", "location": self.driver_at(PICKUP)})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_same_idempotency_key_replays_the_response(self):
        headers = idem()
        body = {"status": "in_progress", "location": self.driver_at(PICKUP)}
        first = self.client.put(self.detail(self.booking), body, format="json", **headers)
        second = self.client.put(self.detail(self.booking), body, format="json", **headers)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second["Idempotent-Replayed"], "true")


class PickupProximityHelperTests(TestCase):
    def setUp(self):
        cache.clear()
        make_toda()
        self.booking = make_booking(make_passenger())

    def test_distance_and_radius(self):
        near = offset(PICKUP, 100)
        far = offset(PICKUP, 400)
        self.assertAlmostEqual(distance_to_pickup_m(self.booking, near["lat"], near["lng"]), 100, delta=2)
        self.assertTrue(is_near_pickup(self.booking, near["lat"], near["lng"]))
        self.assertFalse(is_near_pickup(self.booking, far["lat"], far["lng"]))

    def test_get_driver_coords_prefers_request_location(self):
        cache.set(f"booking_{self.booking.id}_driver_location", {"coords": {"latitude": 1, "longitude": 2}}, 20)
        self.assertEqual(get_driver_coords(self.booking.id, {"latitude": 14.5, "longitude": 121.0}), (14.5, 121.0))
        self.assertEqual(get_driver_coords(self.booking.id, None), (1.0, 2.0))

    def test_get_driver_coords_none_when_unknown(self):
        self.assertIsNone(get_driver_coords(self.booking.id, None))
        cache.set(f"booking_{self.booking.id}_driver_location", "garbage", 20)
        self.assertIsNone(get_driver_coords(self.booking.id, {"latitude": "x"}))


# ---------------------------------------------------------------------------
# Driver queue
# ---------------------------------------------------------------------------
class DriverQueueTests(BookingBase):
    def queue(self, body):
        return self.client.post(reverse(QUEUE), body, format="json")

    def test_driver_joins_queue(self):
        self.as_user(self.driver.user)
        res = self.queue(PICKUP)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["location"], PICKUP)
        self.assertTrue(DriverQueue.objects.filter(driver=self.driver).exists())

    def test_cannot_join_twice(self):
        queue_driver(self.driver)
        self.as_user(self.driver.user)
        res = self.queue(PICKUP)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(DriverQueue.objects.filter(driver=self.driver).count(), 1)

    def test_passenger_cannot_join(self):
        self.as_user(self.passenger.user)
        self.assertEqual(self.queue(PICKUP).status_code, status.HTTP_403_FORBIDDEN)

    def test_blacklisted_pending_and_unverified_drivers_rejected(self):
        for extra in ({"status": "BLACKLISTED"}, {"status": "PENDING"}, {"verified": False}):
            driver = make_driver(self.toda, self.station, **extra)
            self.as_user(driver.user)
            self.assertEqual(self.queue(PICKUP).status_code, status.HTTP_403_FORBIDDEN, extra)

    def test_invalid_coordinates(self):
        self.as_user(self.driver.user)
        for body in ({}, {"lat": "x", "lng": "y"}, {"lat": 95, "lng": 0}):
            self.assertEqual(self.queue(body).status_code, status.HTTP_400_BAD_REQUEST, body)

    def test_dequeue(self):
        queue_driver(self.driver)
        self.as_user(self.driver.user)
        res = self.client.delete(reverse(DEQUEUE))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DriverQueue.objects.filter(driver=self.driver).exists())

    def test_mobile_paths(self):
        """mobile/api/driver.js hard-codes these; dequeue once pointed at the POST-only queue URL (405)."""
        self.assertEqual(reverse(QUEUE), "/api/booking/driver/queue")
        self.assertEqual(reverse(DEQUEUE), "/api/booking/driver/dequeue")

        queue_driver(self.driver)
        self.as_user(self.driver.user)
        self.assertEqual(self.client.delete(reverse(QUEUE)).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(DriverQueue.objects.filter(driver=self.driver).exists())

    def test_dequeue_when_not_queued(self):
        self.as_user(self.driver.user)
        self.assertEqual(self.client.delete(reverse(DEQUEUE)).status_code, status.HTTP_404_NOT_FOUND)

    def test_status_ready(self):
        queue_driver(self.driver)
        self.as_user(self.driver.user)
        res = self.client.get(reverse(QUEUE_STATUS))
        self.assertTrue(res.data["ready"])
        self.assertFalse(res.data["en_route"])
        self.assertEqual(res.data["location"], PICKUP)

    def test_status_en_route(self):
        booking = make_booking(self.passenger, self.driver)
        self.as_user(self.driver.user)
        res = self.client.get(reverse(QUEUE_STATUS))
        self.assertFalse(res.data["ready"])
        self.assertTrue(res.data["en_route"])
        self.assertEqual(res.data["booking_id"], booking.id)

    def test_status_for_non_driver(self):
        self.as_user(self.passenger.user)
        res = self.client.get(reverse(QUEUE_STATUS))
        self.assertEqual(res.data, {"ready": False, "en_route": False})


# ---------------------------------------------------------------------------
# Fare estimate
# ---------------------------------------------------------------------------
class FareEstimateTests(BookingBase):
    def fare(self, query):
        self.as_user(self.passenger.user)
        return self.client.post(f"{reverse(FARE)}?{query}")

    def test_short_trip_costs_base_fare(self):
        res = self.fare("start=14.55,121.05&end=14.551,121.051")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["price"], 15)

    def test_longer_trip_adds_per_km(self):
        res = self.fare("start=14.51,121.01&end=14.59,121.09")
        self.assertGreater(res.data["price"], 15)

    def test_stops_increase_price(self):
        direct = self.fare("start=14.55,121.05&end=14.56,121.06").data["price"]
        with_stop = self.fare("start=14.55,121.05&end=14.56,121.06&stops=14.59,121.01").data["price"]
        self.assertGreater(with_stop, direct)

    def test_errors(self):
        cases = {
            "end=14.56,121.06": "required",
            "start=abc&end=14.56,121.06": "Invalid coordinates",
            "start=14.55&end=14.56,121.06": "lat,lng",
            "start=14.55,121.05&end=14.56,121.06&stops=bad": "Invalid stop",
            "start=14.70,121.30&end=14.56,121.06": "outside",
        }
        for query, message in cases.items():
            res = self.fare(query)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, query)
            self.assertIn(message, res.data["error"], query)


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------
class RateTests(BookingBase):
    def setUp(self):
        super().setUp()
        self.booking = make_booking(self.passenger, self.driver, status=Booking.Status.COMPLETED)

    def rate(self, rater, rated_user_id, score=5, **extra):
        self.as_user(rater)
        body = {"booking_id": self.booking.id, "user_id": rated_user_id, "score": score, **extra}
        return self.client.post(reverse(RATE), body, format="json")

    def test_passenger_rates_driver_and_average_updates(self):
        res = self.rate(self.passenger.user, self.driver.user.id, score=4, feedback="Smooth ride")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["rated_role"], "driver")
        self.driver.refresh_from_db()
        self.assertEqual(float(self.driver.rating), 4.0)

    def test_driver_rates_passenger(self):
        res = self.rate(self.driver.user, self.passenger.user.id, score=3)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["rated_role"], "passenger")

    def test_rated_user_sees_feedback(self):
        self.rate(self.passenger.user, self.driver.user.id, feedback="Nice")
        self.as_user(self.driver.user)
        res = self.client.get(reverse(RATE))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_cannot_rate_twice(self):
        self.rate(self.passenger.user, self.driver.user.id)
        res = self.rate(self.passenger.user, self.driver.user.id)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Rate.objects.count(), 1)

    def test_cannot_rate_self(self):
        res = self.rate(self.passenger.user, self.passenger.user.id)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_outsider_cannot_rate(self):
        res = self.rate(make_passenger().user, self.driver.user.id)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_rated_user_must_be_in_booking(self):
        res = self.rate(self.passenger.user, make_passenger().user.id)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_score_out_of_range(self):
        for score in (0, 6):
            res = self.rate(self.passenger.user, self.driver.user.id, score=score)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, score)

    def test_unknown_booking(self):
        self.as_user(self.passenger.user)
        res = self.client.post(reverse(RATE), {"booking_id": 999999, "user_id": self.driver.user.id, "score": 5}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Driver assignment (assign_driver_sync)
# ---------------------------------------------------------------------------
@mock.patch("api.features.booking.helpers.offer_driver.broadcast")
@mock.patch("api.features.booking.helpers.booking_error.broadcast")
class DriverAssignmentTests(TestCase):
    def setUp(self):
        cache.clear()
        self.toda = make_toda()
        self.station = make_station(self.toda)
        self.passenger = make_passenger()
        self.booking = make_booking(self.passenger, status=Booking.Status.PENDING)

    def test_offers_booking_to_nearest_queued_driver(self, error_broadcast, offer_broadcast):
        near = make_driver(self.toda, self.station)
        far = make_driver(self.toda, self.station)
        queue_driver(near, PICKUP)
        queue_driver(far, offset(PICKUP, 2000))

        with self.captureOnCommitCallbacks(execute=True):
            assign_driver_sync(self.booking.id)

        offer_broadcast.assert_called_once()
        self.assertEqual(offer_broadcast.call_args[0][0], f"driver_{near.user.id}")
        self.assertEqual(cache.get(f"driver_{near.id}_booking")["id"], self.booking.id)
        # the offered driver leaves the queue while deciding
        self.assertFalse(DriverQueue.objects.filter(driver=near).exists())
        self.assertTrue(DriverQueue.objects.filter(driver=far).exists())
        error_broadcast.assert_not_called()

    def test_excluded_driver_is_skipped(self, error_broadcast, offer_broadcast):
        declined = make_driver(self.toda, self.station)
        other = make_driver(self.toda, self.station)
        queue_driver(declined, PICKUP)
        queue_driver(other, offset(PICKUP, 500))

        with self.captureOnCommitCallbacks(execute=True):
            assign_driver_sync(self.booking.id, exclude_driver_ids=[declined.id])

        self.assertEqual(offer_broadcast.call_args[0][0], f"driver_{other.user.id}")

    def test_inactive_drivers_are_not_offered(self, error_broadcast, offer_broadcast):
        queue_driver(make_driver(self.toda, self.station, status="BLACKLISTED"))
        queue_driver(make_driver(self.toda, self.station, verified=False))

        with self.captureOnCommitCallbacks(execute=True):
            assign_driver_sync(self.booking.id)

        offer_broadcast.assert_not_called()
        self.assertEqual(error_broadcast.call_args[0][2]["message"], "No drivers are currently available.")

    def test_no_drivers_deletes_booking_and_tells_passenger(self, error_broadcast, offer_broadcast):
        with self.captureOnCommitCallbacks(execute=True):
            assign_driver_sync(self.booking.id)

        self.assertFalse(Booking.objects.filter(id=self.booking.id).exists())
        channel, event, data = error_broadcast.call_args[0]
        self.assertEqual(channel, f"user_{self.passenger.user.id}")
        self.assertEqual(event, "booking_unavailable")
        self.assertEqual(data["booking_id"], self.booking.id)

    def test_already_accepted_booking_is_not_reassigned(self, error_broadcast, offer_broadcast):
        """Regression: a late re-assignment (after a decline/timeout) used to delete an accepted ride."""
        driver = make_driver(self.toda, self.station)
        self.booking.status = Booking.Status.ACCEPTED
        self.booking.driver = driver
        self.booking.save()
        queue_driver(make_driver(self.toda, self.station))

        with self.captureOnCommitCallbacks(execute=True):
            assign_driver_sync(self.booking.id)

        self.booking.refresh_from_db()
        self.assertEqual((self.booking.status, self.booking.driver_id), (Booking.Status.ACCEPTED, driver.id))
        offer_broadcast.assert_not_called()
        # the passenger must not be told their accepted ride is unavailable
        error_broadcast.assert_not_called()

    def test_finished_bookings_are_left_alone(self, error_broadcast, offer_broadcast):
        driver = make_driver(self.toda, self.station)
        for booking_status in (Booking.Status.IN_PROGRESS, Booking.Status.COMPLETED, Booking.Status.CANCELLED):
            Booking.objects.filter(id=self.booking.id).update(status=booking_status, driver=driver)

            with self.captureOnCommitCallbacks(execute=True):
                assign_driver_sync(self.booking.id)

            self.assertTrue(Booking.objects.filter(id=self.booking.id, status=booking_status).exists(), booking_status)
        error_broadcast.assert_not_called()

    def test_unknown_booking_is_ignored(self, error_broadcast, offer_broadcast):
        assign_driver_sync(999999)
        offer_broadcast.assert_not_called()
        error_broadcast.assert_not_called()


# ---------------------------------------------------------------------------
# Ride history
# ---------------------------------------------------------------------------
@mock.patch("api.features.chat.signals.broadcast")
class BookingHistoryTests(BookingBase):
    URL = "booking-history"

    def setUp(self):
        super().setUp()
        self.completed = make_booking(self.passenger, self.driver, status=Booking.Status.COMPLETED)
        self.cancelled = make_booking(self.passenger, self.driver, status=Booking.Status.CANCELLED)
        self.active = make_booking(self.passenger, self.driver, status=Booking.Status.IN_PROGRESS)
        make_booking(make_passenger(), make_driver(self.toda, self.station), status=Booking.Status.COMPLETED)

    def history(self, user):
        self.as_user(user)
        return self.client.get(reverse(self.URL))

    def test_passenger_sees_own_finished_rides_newest_first(self, _broadcast):
        res = self.history(self.passenger.user)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([b["id"] for b in res.data], [self.cancelled.id, self.completed.id])

    def test_driver_sees_rides_they_drove(self, _broadcast):
        res = self.history(self.driver.user)
        self.assertEqual({b["id"] for b in res.data}, {self.completed.id, self.cancelled.id})

    def test_active_and_pending_rides_are_excluded(self, _broadcast):
        make_booking(self.passenger, status=Booking.Status.PENDING)
        ids = [b["id"] for b in self.history(self.passenger.user).data]
        self.assertNotIn(self.active.id, ids)
        self.assertEqual(len(ids), 2)

    def test_detail_fields(self, _broadcast):
        from api.features.chat.models import Message
        Message.objects.create(booking=self.completed, sender=self.driver.user, receiver=self.passenger.user, message="Here")
        Message.objects.create(booking=self.completed, sender=self.passenger.user, receiver=self.driver.user, message="Coming")
        Rate.objects.create(user=self.driver.user, rater=self.passenger.user, booking=self.completed, score=5)

        item = next(b for b in self.history(self.passenger.user).data if b["id"] == self.completed.id)

        self.assertEqual(item["start"], PICKUP)
        self.assertEqual(item["end"], DROPOFF)
        self.assertEqual(item["status"], "completed")
        self.assertEqual(item["type"], "regular")
        self.assertEqual(item["driver"]["vehicle_plate"], self.driver.vehicle_plate)
        self.assertEqual(item["passenger"]["username"], self.passenger.user.username)
        self.assertEqual([m["message"] for m in item["messages"]], ["Here", "Coming"])
        self.assertEqual(item["messages"][0]["sender_id"], self.driver.user.id)
        self.assertEqual(item["ratings"][0]["score"], 5)
        self.assertIsNone(item["routes"])

    def test_saved_route_polyline_is_returned(self, _broadcast):
        route = [{"lat": 14.55, "lng": 121.05}, {"lat": 14.555, "lng": 121.055}, DROPOFF]
        Booking.objects.filter(id=self.completed.id).update(routes=route)
        item = next(b for b in self.history(self.passenger.user).data if b["id"] == self.completed.id)
        self.assertEqual(item["routes"], route)

    def test_query_count_does_not_grow_with_rides(self, _broadcast):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        self.as_user(self.passenger.user)
        with CaptureQueriesContext(connection) as few:
            self.client.get(reverse(self.URL))
        for _ in range(5):
            make_booking(self.passenger, make_driver(self.toda, self.station), status=Booking.Status.COMPLETED)
        with CaptureQueriesContext(connection) as many:
            self.client.get(reverse(self.URL))

        self.assertEqual(len(few), len(many))

    def test_user_without_role(self, _broadcast):
        res = self.history(make_admin("TODA"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_rejected(self, _broadcast):
        self.assertEqual(self.client.get(reverse(self.URL)).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_history_is_read_only(self, _broadcast):
        self.as_user(self.passenger.user)
        res = self.client.post(reverse(self.URL), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
