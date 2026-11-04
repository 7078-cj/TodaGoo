"""A booking offer must be handled once: whichever of accept / decline / the 30 s timeout comes
first wins, and the others do nothing. Before this, a decline re-offered the booking to the next
driver and the declining driver's still-running timer re-offered it again 30 s later (duplicate
offer), and a client auto-decline racing the server timeout did the same."""
from unittest import mock

from django.core.cache import cache
from django.test import TestCase

from api.features.booking.helpers.offer_guard import claim_offer, is_booking_offered_to
from api.features.booking.models import Booking, DriverQueue
from api.features.booking.utils import assign_driver_sync
from websocket.features.driver import DriverConsumer

from .factories import PICKUP, make_booking, make_driver, make_passenger, make_station, make_toda, offset, queue_driver


def consumer_for(driver):
    consumer = DriverConsumer()
    consumer.driver = driver
    consumer.user = driver.user
    return consumer


# the sync functions behind the consumer's @database_sync_to_async methods
expire = DriverConsumer.__dict__["booking_expired"].func
accept = DriverConsumer.__dict__["accept_booking"].func
decline = DriverConsumer.__dict__["decline_booking"].func


@mock.patch("api.features.booking.helpers.booking_error.broadcast")
@mock.patch("api.features.booking.helpers.offer_driver.broadcast")
class OfferFlowTests(TestCase):
    def setUp(self):
        cache.clear()
        toda = make_toda()
        station = make_station(toda)
        self.passenger = make_passenger()
        self.a = make_driver(toda, station)   # nearest: gets the first offer
        self.b = make_driver(toda, station)
        queue_driver(self.a, PICKUP)
        queue_driver(self.b, offset(PICKUP, 500))
        self.booking = make_booking(self.passenger, status=Booking.Status.PENDING)

        # broadcasts from the expiry notice / booking_updated signal aren't under test here
        for target in ("websocket.features.driver.broadcast", "api.features.booking.signals.broadcast"):
            patcher = mock.patch(target, create=True)
            patcher.start()
            self.addCleanup(patcher.stop)

    def run_on_commit(self, fn, *args):
        with self.captureOnCommitCallbacks(execute=True):
            return fn(*args)

    def offers_to(self, offer_broadcast, driver):
        return [c for c in offer_broadcast.call_args_list if c.args[0] == f"driver_{driver.user.id}"]

    def location(self):
        return {"latitude": PICKUP["lat"], "longitude": PICKUP["lng"]}

    def test_decline_then_old_timer_does_not_reoffer(self, offer_broadcast, _error):
        self.run_on_commit(assign_driver_sync, self.booking.id)
        self.assertTrue(is_booking_offered_to(self.a.id, self.booking.id))

        self.assertTrue(self.run_on_commit(decline, consumer_for(self.a), self.booking.id, self.location()))
        self.assertEqual(len(self.offers_to(offer_broadcast, self.b)), 1)

        # A's 30 s timer from the first offer fires while B is still deciding
        self.run_on_commit(expire, consumer_for(self.a), self.booking.id)

        self.assertEqual(len(self.offers_to(offer_broadcast, self.b)), 1, "B was offered the same booking twice")
        self.assertTrue(is_booking_offered_to(self.b.id, self.booking.id))

    def test_timeout_and_client_auto_decline_reassign_once(self, offer_broadcast, _error):
        self.run_on_commit(assign_driver_sync, self.booking.id)

        self.run_on_commit(expire, consumer_for(self.a), self.booking.id)      # server timer
        declined = self.run_on_commit(decline, consumer_for(self.a), self.booking.id, self.location())  # app at 0 s

        self.assertFalse(declined)
        self.assertEqual(len(self.offers_to(offer_broadcast, self.b)), 1)

    def test_two_sockets_two_timers_expire_once(self, offer_broadcast, _error):
        self.run_on_commit(assign_driver_sync, self.booking.id)

        self.run_on_commit(expire, consumer_for(self.a), self.booking.id)
        self.run_on_commit(expire, consumer_for(self.a), self.booking.id)

        self.assertEqual(len(self.offers_to(offer_broadcast, self.b)), 1)

    def test_accept_then_timer_does_nothing(self, offer_broadcast, _error):
        self.run_on_commit(assign_driver_sync, self.booking.id)

        data = self.run_on_commit(accept, consumer_for(self.a), self.booking.id)
        self.assertEqual(data["status"], "accepted")

        self.run_on_commit(expire, consumer_for(self.a), self.booking.id)

        self.booking.refresh_from_db()
        self.assertEqual((self.booking.status, self.booking.driver_id), (Booking.Status.ACCEPTED, self.a.id))
        self.assertEqual(self.offers_to(offer_broadcast, self.b), [])
        self.assertFalse(DriverQueue.objects.filter(driver=self.a).exists())

    def test_accept_after_expiry_is_rejected(self, offer_broadcast, _error):
        self.run_on_commit(assign_driver_sync, self.booking.id)
        self.run_on_commit(expire, consumer_for(self.a), self.booking.id)

        data = self.run_on_commit(accept, consumer_for(self.a), self.booking.id)

        self.assertFalse(data["success"])
        self.booking.refresh_from_db()
        self.assertIsNone(self.booking.driver_id)

    def test_double_tap_decline_reassigns_once(self, offer_broadcast, _error):
        self.run_on_commit(assign_driver_sync, self.booking.id)

        first = self.run_on_commit(decline, consumer_for(self.a), self.booking.id, self.location())
        second = self.run_on_commit(decline, consumer_for(self.a), self.booking.id, self.location())

        self.assertEqual((first, second), (True, False))
        self.assertEqual(len(self.offers_to(offer_broadcast, self.b)), 1)

    def test_invalid_location_keeps_the_offer_open(self, offer_broadcast, _error):
        self.run_on_commit(assign_driver_sync, self.booking.id)

        self.assertFalse(self.run_on_commit(decline, consumer_for(self.a), self.booking.id, {"latitude": "x"}))

        self.assertTrue(is_booking_offered_to(self.a.id, self.booking.id))
        # ...so the timer still ends it
        self.run_on_commit(expire, consumer_for(self.a), self.booking.id)
        self.assertEqual(len(self.offers_to(offer_broadcast, self.b)), 1)

    def test_expiry_tells_the_driver_app_to_close_the_offer(self, offer_broadcast, _error):
        self.run_on_commit(assign_driver_sync, self.booking.id)
        with mock.patch("websocket.features.driver.broadcast", create=True) as notice:
            self.run_on_commit(expire, consumer_for(self.a), self.booking.id)
        notice.assert_called_once_with(f"driver_{self.a.user.id}", "offer_expired", {"booking_id": self.booking.id})

    def test_same_driver_can_be_offered_the_booking_again_later(self, offer_broadcast, _error):
        self.run_on_commit(assign_driver_sync, self.booking.id)
        self.assertTrue(claim_offer(self.a.id, self.booking.id))
        self.assertFalse(claim_offer(self.a.id, self.booking.id))

        # a fresh offer of the same booking to the same driver can be answered again
        DriverQueue.objects.filter(driver=self.a).delete()
        queue_driver(self.a, PICKUP)
        self.run_on_commit(assign_driver_sync, self.booking.id)
        self.assertTrue(claim_offer(self.a.id, self.booking.id))
