"""
The passenger cancels a ride before pickup: POST booking/<id>/cancel/ (booking/views.py cancel_booking).

  pending  -> deleted (like DELETE booking/<id>/)
  accepted -> status "cancelled": kept in history, the driver's app gets a booking_update
              (booking/signals.py) and the driver a "booking_cancelled" notification
  in_progress / completed / cancelled -> 400

Live updates run on commit: captureOnCommitCallbacks(execute=True) runs them, and
booking.signals.broadcast is replaced by a mock so nothing is sent.
"""
from unittest import mock

from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.features.booking.models import Booking
from api.features.user.models import Notification

from .factories import PICKUP, idem, make_admin, make_booking, make_driver, make_passenger, make_station, make_toda

CANCEL = "booking-cancel"


@mock.patch("api.features.booking.signals.broadcast")
class CancelBookingTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.toda = make_toda()
        self.station = make_station(self.toda)
        self.passenger = make_passenger()
        self.driver = make_driver(self.toda, self.station)

    def cancel(self, booking, user=None):
        self.client.force_authenticate(user or self.passenger.user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse(CANCEL, args=[booking.id]), {}, format="json")

    def booking(self, status_):
        return make_booking(self.passenger, self.driver if status_ != Booking.Status.PENDING else None, status=status_)

    def driver_notifications(self):
        return list(Notification.objects.filter(user=self.driver.user, type=Notification.Type.BOOKING_CANCELLED))

    # ---- allowed ---------------------------------------------------------------------------
    def test_accepted_ride_is_cancelled_and_kept(self, broadcast):
        booking = self.booking(Booking.Status.ACCEPTED)
        res = self.cancel(booking)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["status"], "cancelled")
        self.assertEqual(Booking.objects.get(id=booking.id).status, Booking.Status.CANCELLED)

    def test_driver_app_is_told_live(self, broadcast):
        booking = self.booking(Booking.Status.ACCEPTED)
        self.cancel(booking)
        sent = {(call.args[0], call.args[1]): call.args[2] for call in broadcast.call_args_list}
        driver_msg = sent[(f"driver_{self.driver.user.id}", "booking_update")]
        self.assertEqual((driver_msg["id"], driver_msg["status"]), (booking.id, "cancelled"))
        # the passenger's other screens / devices hear it too
        self.assertEqual(sent[(f"user_{self.passenger.user.id}", "booking_accepted")]["status"], "cancelled")

    def test_driver_is_notified(self, broadcast):
        booking = self.booking(Booking.Status.ACCEPTED)
        self.cancel(booking)
        (n,) = self.driver_notifications()
        self.assertEqual(n.booking_id, booking.id)
        self.assertEqual(n.message, f"Booking #{booking.id} was cancelled by the passenger.")
        self.assertFalse(
            Notification.objects.filter(user=self.passenger.user, type=Notification.Type.BOOKING_CANCELLED).exists()
        )

    def test_driver_is_free_again(self, broadcast):
        self.cancel(self.booking(Booking.Status.ACCEPTED))
        self.client.force_authenticate(self.driver.user)
        res = self.client.get(reverse("driver-queue-status"))
        self.assertEqual((res.data["en_route"], res.data["booking_id"]), (False, None))

    def test_driver_can_no_longer_pick_up(self, broadcast):
        booking = self.booking(Booking.Status.ACCEPTED)
        self.cancel(booking)
        self.client.force_authenticate(self.driver.user)
        res = self.client.put(
            reverse("booking-detail", args=[booking.id]),
            {"status": "in_progress", "location": {"latitude": PICKUP["lat"], "longitude": PICKUP["lng"]}},
            format="json", **idem(),
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot transition booking from 'cancelled'", res.data["error"])

    def test_cancelled_ride_is_in_both_histories(self, broadcast):
        booking = self.booking(Booking.Status.ACCEPTED)
        self.cancel(booking)
        for user in (self.passenger.user, self.driver.user):
            self.client.force_authenticate(user)
            ids = [b["id"] for b in self.client.get(reverse("booking-history")).data]
            self.assertIn(booking.id, ids, user.username)

    def test_passenger_can_book_again_after_cancelling(self, broadcast):
        self.cancel(self.booking(Booking.Status.ACCEPTED))
        self.client.force_authenticate(self.passenger.user)
        with mock.patch("api.features.booking.signals._run_assignment"):
            res = self.client.post(
                reverse("booking-list"),
                {"start": PICKUP, "start_address": "A", "end": {"lat": 14.56, "lng": 121.06}, "end_address": "B",
                 "stops": [], "type": "regular"},
                format="json", **idem(),
            )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_pending_booking_is_deleted_like_before(self, broadcast):
        booking = self.booking(Booking.Status.PENDING)
        res = self.cancel(booking)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, {"id": booking.id, "status": "cancelled"})
        self.assertFalse(Booking.objects.filter(id=booking.id).exists())
        self.assertEqual(self.driver_notifications(), [])

    # ---- refused ---------------------------------------------------------------------------
    def test_after_pickup_it_is_refused(self, broadcast):
        booking = self.booking(Booking.Status.IN_PROGRESS)
        res = self.cancel(booking)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["error"], "Your driver has already picked you up, so the ride can't be cancelled.")
        self.assertEqual(Booking.objects.get(id=booking.id).status, Booking.Status.IN_PROGRESS)
        self.assertEqual(self.driver_notifications(), [])
        broadcast.assert_not_called()

    def test_finished_rides_are_refused(self, broadcast):
        for status_ in (Booking.Status.COMPLETED, Booking.Status.CANCELLED):
            with self.subTest(status=status_):
                booking = self.booking(status_)
                res = self.cancel(booking)
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(res.data["error"], "This ride has already ended.")
                self.assertEqual(Booking.objects.get(id=booking.id).status, status_)

    def test_cancelling_twice(self, broadcast):
        booking = self.booking(Booking.Status.ACCEPTED)
        self.assertEqual(self.cancel(booking).status_code, status.HTTP_200_OK)
        self.assertEqual(self.cancel(booking).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(self.driver_notifications()), 1)

    def test_another_passenger_cannot_cancel_it(self, broadcast):
        booking = self.booking(Booking.Status.ACCEPTED)
        res = self.cancel(booking, user=make_passenger().user)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Booking.objects.get(id=booking.id).status, Booking.Status.ACCEPTED)

    def test_the_driver_cannot_use_it(self, broadcast):
        booking = self.booking(Booking.Status.ACCEPTED)
        res = self.cancel(booking, user=self.driver.user)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["error"], "User is not a passenger")

    def test_admins_cannot_use_it(self, broadcast):
        res = self.cancel(self.booking(Booking.Status.ACCEPTED), user=make_admin())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_booking(self, broadcast):
        self.client.force_authenticate(self.passenger.user)
        res = self.client.post(reverse(CANCEL, args=[999999]), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_needs_login(self, broadcast):
        booking = self.booking(Booking.Status.ACCEPTED)
        res = self.client.post(reverse(CANCEL, args=[booking.id]), {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
