"""
WebSocket consumers, driven through the real URL router with an in-memory channel layer.

TransactionTestCase: consumers use database_sync_to_async, which closes connections that are
inside a transaction, so the usual per-test transaction of TestCase can't be used here.
The JWT middleware is skipped; scope["user"] is set directly (token parsing is covered in
SecurityFixesTest).
"""
import asyncio
import json
from unittest import mock

from asgiref.sync import sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.core.cache import cache
from django.test import TransactionTestCase, override_settings

from api.features.booking.models import Booking
from api.features.notifications import chat_presence
from api.features.user.models import Notification
from api.features.user.utils import create_notification
from websocket.routing import websocket_urlpatterns

from .factories import PICKUP, make_booking, make_driver, make_passenger, make_station, make_toda, offset, queue_driver

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class ConsumerBase(TransactionTestCase):
    def setUp(self):
        cache.clear()
        # A new pending booking starts the real driver-assignment thread on commit. Here that
        # would delete the booking under the test and hold locks during the DB flush.
        patcher = mock.patch("api.features.booking.signals._run_assignment")
        patcher.start()
        self.addCleanup(patcher.stop)
        self.toda = make_toda()
        self.station = make_station(self.toda)
        self.passenger = make_passenger()
        self.driver = make_driver(self.toda, self.station)

    async def connect(self, path, user):
        communicator = WebsocketCommunicator(URLRouter(websocket_urlpatterns), path, subprotocols=["access_token", "x"])
        communicator.scope["user"] = user
        connected, subprotocol = await communicator.connect()
        self._sockets = getattr(self, "_sockets", []) + [communicator]
        return communicator, connected, subprotocol

    async def close_all(self):
        for communicator in getattr(self, "_sockets", []):
            try:
                await communicator.disconnect()
            except Exception:
                pass  # already closed by the server or the test

    async def receive_type(self, communicator, wanted, timeout=2):
        """Read messages until one of type `wanted` arrives (others are skipped)."""
        async def _read():
            while True:
                message = json.loads(await communicator.receive_from())
                if message.get("type") == wanted:
                    return message
        return await asyncio.wait_for(_read(), timeout)


# ---------------------------------------------------------------------------
# ws/notifications/<user_id>
# ---------------------------------------------------------------------------
class NotificationConsumerTests(ConsumerBase):
    async def test_receives_created_notification(self):
        """Regression: this crashed with "module 'django.core.serializers.json' has no attribute 'dumps'"."""
        user = self.passenger.user
        communicator, connected, subprotocol = await self.connect(f"/ws/notifications/{user.id}", user)
        self.assertTrue(connected)
        self.assertEqual(subprotocol, "access_token")

        notification = await sync_to_async(create_notification)(user, "Your driver is near")

        message = await self.receive_type(communicator, "notification_update")
        self.assertEqual(message["action"], "created")
        self.assertEqual(message["notification"]["id"], notification.id)
        self.assertEqual(message["notification"]["message"], "Your driver is near")
        await self.close_all()

    async def test_ride_events_do_not_crash_the_notification_socket(self):
        """Regression: it shared user_<id> with ride events and crashed with
        "No handler for message type booking_accepted" after a booking update."""
        from api.broadcast import broadcast
        user = self.passenger.user
        communicator, connected, _ = await self.connect(f"/ws/notifications/{user.id}", user)
        self.assertTrue(connected)

        for event in ("booking_accepted", "booking_completed", "booking_unavailable"):
            await sync_to_async(broadcast)(f"user_{user.id}", event, {"id": 1})

        # the socket is still open and still delivers notifications
        await sync_to_async(create_notification)(user, "Your driver is near")
        message = await self.receive_type(communicator, "notification_update")
        self.assertEqual(message["notification"]["message"], "Your driver is near")
        await self.close_all()

    async def test_other_users_socket_is_rejected(self):
        _, connected, code = await self.connect(f"/ws/notifications/{self.driver.user.id}", self.passenger.user)
        self.assertFalse(connected)
        self.assertEqual(code, 4003)
        await self.close_all()

    async def test_anonymous_is_rejected(self):
        from django.contrib.auth.models import AnonymousUser
        _, connected, _ = await self.connect(f"/ws/notifications/{self.passenger.user.id}", AnonymousUser())
        self.assertFalse(connected)
        await self.close_all()


# ---------------------------------------------------------------------------
# ws/passenger/<user_id>
# ---------------------------------------------------------------------------
class PassengerConsumerTests(ConsumerBase):
    async def open(self):
        user = self.passenger.user
        communicator, connected, _ = await self.connect(f"/ws/passenger/{user.id}", user)
        self.assertTrue(connected)
        return communicator

    async def test_gets_ready_driver_count_on_connect(self):
        await sync_to_async(queue_driver)(self.driver)
        communicator = await self.open()
        message = await self.receive_type(communicator, "driver_availability")
        self.assertEqual(message["data"], {"ready_drivers": 1})
        await self.close_all()

    async def test_gets_new_count_when_a_driver_queues_or_leaves(self):
        communicator = await self.open()
        self.assertEqual((await self.receive_type(communicator, "driver_availability"))["data"]["ready_drivers"], 0)

        entry = await sync_to_async(queue_driver)(self.driver)
        self.assertEqual((await self.receive_type(communicator, "driver_availability"))["data"]["ready_drivers"], 1)

        await sync_to_async(entry.delete)()
        self.assertEqual((await self.receive_type(communicator, "driver_availability"))["data"]["ready_drivers"], 0)
        await self.close_all()

    async def test_notifications_do_not_go_to_the_passenger_socket(self):
        """Notifications have their own group; the passenger socket only gets ride events."""
        communicator = await self.open()
        await self.receive_type(communicator, "driver_availability")

        await sync_to_async(create_notification)(self.passenger.user, "hi")
        self.assertTrue(await communicator.receive_nothing(timeout=0.3))

        # still alive: a later broadcast still arrives
        await sync_to_async(queue_driver)(self.driver)
        await self.receive_type(communicator, "driver_availability")
        await self.close_all()

    async def test_resumes_active_booking_on_connect(self):
        booking = await sync_to_async(make_booking)(self.passenger, self.driver)
        communicator = await self.open()
        message = await self.receive_type(communicator, "booking_accepted")
        self.assertEqual(message["data"]["id"], booking.id)
        await self.close_all()


# ---------------------------------------------------------------------------
# ws/booking/<booking_id>
# ---------------------------------------------------------------------------
class BookingConsumerTests(ConsumerBase):
    def setUp(self):
        super().setUp()
        self.booking = make_booking(self.passenger, self.driver)

    async def open(self, user):
        communicator, connected, code = await self.connect(f"/ws/booking/{self.booking.id}", user)
        return communicator, connected, code

    def location(self, coords):
        return {"action": "driver_location", "location": {"coords": {"latitude": coords["lat"], "longitude": coords["lng"]}}}

    async def test_non_participant_rejected(self):
        outsider = await sync_to_async(make_passenger)()
        _, connected, code = await self.open(outsider.user)
        self.assertFalse(connected)
        self.assertEqual(code, 4003)
        await self.close_all()

    async def test_completed_booking_rejected(self):
        await sync_to_async(Booking.objects.filter(id=self.booking.id).update)(status=Booking.Status.COMPLETED)
        _, connected, code = await self.open(self.passenger.user)
        self.assertFalse(connected)
        self.assertEqual(code, 4004)
        await self.close_all()

    async def test_driver_location_reaches_passenger_and_nearby_notifies(self):
        passenger_socket, connected, _ = await self.open(self.passenger.user)
        self.assertTrue(connected)
        driver_socket, _, _ = await self.open(self.driver.user)

        near = offset(PICKUP, 50)
        await driver_socket.send_json_to(self.location(near))

        message = await self.receive_type(passenger_socket, "driver_location")
        self.assertAlmostEqual(message["data"]["coords"]["latitude"], near["lat"])
        notifications = await sync_to_async(list)(Notification.objects.filter(user=self.passenger.user).values_list("message", flat=True))
        self.assertEqual(notifications, ["Your driver is near your pickup location."])
        await self.close_all()

    async def test_far_driver_location_does_not_notify(self):
        passenger_socket, _, _ = await self.open(self.passenger.user)
        driver_socket, _, _ = await self.open(self.driver.user)

        await driver_socket.send_json_to(self.location(offset(PICKUP, 2000)))
        await self.receive_type(passenger_socket, "driver_location")

        self.assertFalse(await sync_to_async(Notification.objects.filter(user=self.passenger.user).exists)())
        await self.close_all()

    async def test_passenger_cannot_send_driver_location(self):
        passenger_socket, _, _ = await self.open(self.passenger.user)
        await passenger_socket.send_json_to(self.location(PICKUP))
        self.assertTrue(await passenger_socket.receive_nothing(timeout=0.3))
        self.assertIsNone(cache.get(f"booking_{self.booking.id}_driver_location"))
        await self.close_all()

    async def test_malformed_location_is_ignored(self):
        driver_socket, _, _ = await self.open(self.driver.user)
        await driver_socket.send_json_to({"action": "driver_location", "location": {"coords": {"latitude": "x"}}})
        await driver_socket.send_to(text_data="not json")
        self.assertTrue(await driver_socket.receive_nothing(timeout=0.3))
        await self.close_all()

    async def test_chat_open_close_and_disconnect_track_presence(self):
        driver_socket, _, _ = await self.open(self.driver.user)
        is_open = lambda: chat_presence.is_chat_open(self.booking.id, self.driver.user.id)

        await driver_socket.send_json_to({"action": "chat_open"})
        await driver_socket.receive_nothing(timeout=0.2)
        self.assertTrue(is_open())

        await driver_socket.send_json_to({"action": "chat_close"})
        await driver_socket.receive_nothing(timeout=0.2)
        self.assertFalse(is_open())

        await driver_socket.send_json_to({"action": "chat_open"})
        await driver_socket.receive_nothing(timeout=0.2)
        await driver_socket.disconnect()
        self.assertFalse(is_open())
        await self.close_all()


# ---------------------------------------------------------------------------
# ws/driver/<user_id>
# ---------------------------------------------------------------------------
class DriverConsumerTests(ConsumerBase):
    def setUp(self):
        super().setUp()
        self.booking = make_booking(self.passenger, status=Booking.Status.PENDING)

    async def open(self):
        user = self.driver.user
        communicator, connected, _ = await self.connect(f"/ws/driver/{user.id}", user)
        self.assertTrue(connected)
        return communicator

    async def test_accepting_offered_booking_notifies_passenger(self):
        cache.set(f"driver_{self.driver.id}_booking", {"id": self.booking.id}, 30)
        communicator = await self.open()
        await self.receive_type(communicator, "new_booking")  # resumed offer

        await communicator.send_json_to({"action": "accept_booking", "booking_id": self.booking.id})
        reply = await self.receive_type(communicator, "accept_booking")

        self.assertEqual(reply["data"]["status"], "accepted")
        await sync_to_async(self.booking.refresh_from_db)()
        self.assertEqual(self.booking.driver_id, self.driver.id)
        (message,) = await sync_to_async(list)(
            Notification.objects.filter(user=self.passenger.user).values_list("message", flat=True)
        )
        self.assertIn("was accepted", message)
        await self.close_all()

    async def test_cannot_accept_booking_not_offered(self):
        communicator = await self.open()
        await communicator.send_json_to({"action": "accept_booking", "booking_id": self.booking.id})
        reply = await self.receive_type(communicator, "accept_booking")

        self.assertFalse(reply["data"]["success"])
        self.assertFalse(await sync_to_async(Notification.objects.exists)())
        await self.close_all()

    async def test_cannot_accept_booking_taken_by_another_driver(self):
        other = await sync_to_async(make_driver)(self.toda, self.station)
        await sync_to_async(Booking.objects.filter(id=self.booking.id).update)(driver=other, status=Booking.Status.ACCEPTED)
        cache.set(f"driver_{self.driver.id}_booking", {"id": self.booking.id}, 30)
        communicator = await self.open()

        await communicator.send_json_to({"action": "accept_booking", "booking_id": self.booking.id})
        reply = await self.receive_type(communicator, "accept_booking")

        self.assertEqual(reply["data"], {"success": False, "message": "Booking already taken."})
        await self.close_all()

    async def test_offer_expired_reaches_the_driver_app(self):
        from api.broadcast import broadcast
        communicator = await self.open()

        await sync_to_async(broadcast)(f"driver_{self.driver.user.id}", "offer_expired", {"booking_id": self.booking.id})

        message = await self.receive_type(communicator, "offer_expired")
        self.assertEqual(message["data"], {"booking_id": self.booking.id})
        await self.close_all()

    async def test_passenger_cannot_open_driver_socket(self):
        _, connected, code = await self.connect(f"/ws/driver/{self.passenger.user.id}", self.passenger.user)
        self.assertFalse(connected)
        self.assertEqual(code, 4004)
        await self.close_all()
