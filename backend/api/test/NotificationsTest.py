"""create_notification + broadcast, the notification triggers (booking accepted, driver nearby,
reported, new message), chat presence, the notification REST endpoints, and the
ready-driver count broadcast."""
from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.features.booking.helpers.driver_availability import (
    PASSENGERS_ONLINE_GROUP, count_ready_drivers, driver_availability_payload,
)
from api.features.booking.helpers.pickup_proximity import PICKUP_RADIUS_M
from api.features.booking.models import Booking, DriverQueue
from api.features.chat.models import Message
from api.features.notifications import chat_presence
from api.features.notifications.triggers import (
    notify_booking_accepted, notify_if_driver_nearby, notify_new_message, notify_reported_user,
)
from api.features.reports.models import IncidentReport
from api.features.user.models import Notification
from api.features.user.utils import broadcast_notification, create_notification

from .factories import (
    PICKUP, make_admin, make_booking, make_driver, make_passenger, make_station, make_toda, offset, point,
    queue_driver,
)


class FakeLayer:
    """Stands in for the channel layer and records every group_send."""

    def __init__(self):
        self.sent = []

    async def group_send(self, group, payload):
        self.sent.append((group, payload))


class LayerMixin:
    def setUp(self):
        super().setUp()
        cache.clear()
        self.layer = FakeLayer()
        patcher = mock.patch("api.features.user.utils.get_channel_layer", return_value=self.layer)
        patcher.start()
        self.addCleanup(patcher.stop)


# ---------------------------------------------------------------------------
# create_notification / broadcast_notification / Notification signal
# ---------------------------------------------------------------------------
class CreateNotificationTests(LayerMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.user = make_passenger().user

    def test_creates_and_broadcasts_to_user_group_after_commit(self):
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            notification = create_notification(self.user, "Hello")
            self.assertEqual(self.layer.sent, [], "must wait for the transaction to commit")

        for callback in callbacks:
            callback()

        self.assertEqual(Notification.objects.get().message, "Hello")
        group, payload = self.layer.sent[0]
        self.assertEqual(group, f"user_{self.user.id}")
        self.assertEqual(payload["type"], "notification_update")
        self.assertEqual(payload["action"], "created")
        self.assertEqual(payload["notification"]["id"], notification.id)
        self.assertFalse(payload["notification"]["read"])

    def test_created_notification_is_broadcast_once(self):
        with self.captureOnCommitCallbacks(execute=True):
            create_notification(self.user, "Only once")
        self.assertEqual(len(self.layer.sent), 1)

    def test_update_is_broadcast_by_the_signal(self):
        with self.captureOnCommitCallbacks(execute=True):
            notification = create_notification(self.user, "Read me")
        self.layer.sent.clear()

        notification.read = True
        with self.captureOnCommitCallbacks(execute=True):
            notification.save()

        (_, payload), = self.layer.sent
        self.assertEqual(payload["action"], "updated")
        self.assertTrue(payload["notification"]["read"])

    def test_raw_orm_create_is_not_broadcast(self):
        with self.captureOnCommitCallbacks(execute=True):
            Notification.objects.create(user=self.user, message="silent")
        self.assertEqual(self.layer.sent, [])

    def test_no_channel_layer_is_a_noop(self):
        with mock.patch("api.features.user.utils.get_channel_layer", return_value=None):
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                notification = create_notification(self.user, "offline")
        self.assertEqual(callbacks, [])
        broadcast_notification(notification, "created")  # does not raise


# ---------------------------------------------------------------------------
# Triggers
# ---------------------------------------------------------------------------
class TriggerTests(LayerMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.toda = make_toda()
        self.station = make_station(self.toda)
        self.passenger = make_passenger()
        self.driver = make_driver(self.toda, self.station)
        self.booking = make_booking(self.passenger, self.driver)

    def notifications_for(self, user):
        return list(Notification.objects.filter(user=user).values_list("message", flat=True))

    def test_booking_accepted_notifies_passenger(self):
        notify_booking_accepted(self.booking)
        (message,) = self.notifications_for(self.passenger.user)
        self.assertIn(f"#{self.booking.id} was accepted", message)
        self.assertEqual(self.notifications_for(self.driver.user), [])

    # -- driver nearby -----------------------------------------------------
    def test_driver_nearby_notifies_once(self):
        near = offset(PICKUP, PICKUP_RADIUS_M / 2)
        self.assertTrue(notify_if_driver_nearby(self.booking.id, near["lat"], near["lng"]))
        self.assertFalse(notify_if_driver_nearby(self.booking.id, near["lat"], near["lng"]))
        self.assertEqual(self.notifications_for(self.passenger.user), ["Your driver is near your pickup location."])

    def test_driver_far_away_does_not_notify(self):
        far = offset(PICKUP, PICKUP_RADIUS_M * 3)
        self.assertFalse(notify_if_driver_nearby(self.booking.id, far["lat"], far["lng"]))
        self.assertEqual(self.notifications_for(self.passenger.user), [])

    def test_driver_nearby_after_pickup_does_not_notify(self):
        self.booking.status = Booking.Status.IN_PROGRESS
        self.booking.save()
        self.assertFalse(notify_if_driver_nearby(self.booking.id, PICKUP["lat"], PICKUP["lng"]))

    def test_driver_nearby_unknown_booking(self):
        self.assertFalse(notify_if_driver_nearby(999999, PICKUP["lat"], PICKUP["lng"]))

    # -- reported ----------------------------------------------------------
    def make_report(self, reporter, incident="overcharging"):
        with mock.patch("api.features.reports.signals.get_channel_layer", return_value=None):
            return IncidentReport.objects.create(
                booking=self.booking, reported_by=reporter, location=point(PICKUP), incident_types=incident,
            )

    def test_passenger_report_notifies_driver(self):
        self.make_report(self.passenger.user, "overcharging")
        (message,) = self.notifications_for(self.driver.user)
        self.assertIn("reported for overcharging", message)
        self.assertEqual(self.notifications_for(self.passenger.user), [])

    def test_driver_report_notifies_passenger(self):
        self.make_report(self.driver.user, "harassment")
        (message,) = self.notifications_for(self.passenger.user)
        self.assertIn("reported for harassment", message)

    def test_admin_report_notifies_nobody(self):
        self.make_report(make_admin("TODA"))
        self.assertEqual(Notification.objects.count(), 0)

    def test_report_update_does_not_notify_again(self):
        report = self.make_report(self.passenger.user)
        report.status = "resolved"
        with mock.patch("api.features.reports.signals.get_channel_layer", return_value=None):
            report.save()
        # the reported driver isn't told again; the reporter now gets a "report_update"
        self.assertEqual(Notification.objects.filter(user=self.driver.user).count(), 1)
        self.assertEqual(
            list(Notification.objects.filter(user=self.passenger.user).values_list("type", flat=True)),
            [Notification.Type.REPORT_UPDATE],
        )

    def test_report_on_booking_without_driver(self):
        report = IncidentReport(booking=make_booking(make_passenger(), status=Booking.Status.PENDING),
                                reported_by_id=self.passenger.user.id, location=point(PICKUP))
        notify_reported_user(report)  # passenger isn't on that booking and there is no driver
        self.assertEqual(Notification.objects.count(), 0)

    # -- new message -------------------------------------------------------
    def send(self, sender, receiver, text="hi"):
        with mock.patch("api.features.chat.signals.broadcast"):
            return Message.objects.create(booking=self.booking, sender=sender, receiver=receiver, message=text)

    def test_new_message_notifies_receiver(self):
        self.send(self.passenger.user, self.driver.user, "Where are you?")
        (message,) = self.notifications_for(self.driver.user)
        self.assertIn("Where are you?", message)
        self.assertIn(self.passenger.user.username, message)

    def test_message_not_notified_while_receiver_has_chat_open(self):
        chat_presence.set_chat_open(self.booking.id, self.driver.user.id)
        self.send(self.passenger.user, self.driver.user)
        self.assertEqual(self.notifications_for(self.driver.user), [])

    def test_message_notified_again_after_chat_closed(self):
        chat_presence.set_chat_open(self.booking.id, self.driver.user.id)
        chat_presence.set_chat_closed(self.booking.id, self.driver.user.id)
        self.send(self.passenger.user, self.driver.user)
        self.assertEqual(len(self.notifications_for(self.driver.user)), 1)

    def test_sender_having_chat_open_does_not_matter(self):
        chat_presence.set_chat_open(self.booking.id, self.passenger.user.id)
        self.send(self.passenger.user, self.driver.user)
        self.assertEqual(len(self.notifications_for(self.driver.user)), 1)

    def test_long_message_is_truncated_in_notification(self):
        self.send(self.passenger.user, self.driver.user, "x" * 300)
        (message,) = self.notifications_for(self.driver.user)
        self.assertTrue(message.endswith("x" * 80))
        self.assertNotIn("x" * 81, message)

    def test_chat_presence_is_per_booking_and_user(self):
        chat_presence.set_chat_open(self.booking.id, self.driver.user.id)
        self.assertTrue(chat_presence.is_chat_open(self.booking.id, self.driver.user.id))
        self.assertFalse(chat_presence.is_chat_open(self.booking.id, self.passenger.user.id))
        self.assertFalse(chat_presence.is_chat_open(self.booking.id + 1, self.driver.user.id))


# ---------------------------------------------------------------------------
# Notification REST endpoints
# ---------------------------------------------------------------------------
class NotificationEndpointTests(LayerMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = make_passenger().user
        self.other = make_passenger().user
        self.mine = [create_notification(self.user, f"n{i}") for i in range(3)]
        self.theirs = create_notification(self.other, "not yours")
        self.client.force_authenticate(self.user)

    def test_list_returns_only_own_newest_first(self):
        res = self.client.get(reverse("get_user_notification"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([n["id"] for n in res.data], [n.id for n in reversed(self.mine)])

    def test_mark_one_as_read(self):
        res = self.client.patch(reverse("mark_notification_as_read", args=[self.mine[0].id]))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.mine[0].refresh_from_db()
        self.assertTrue(self.mine[0].read)

    def test_cannot_mark_someone_elses(self):
        res = self.client.patch(reverse("mark_notification_as_read", args=[self.theirs.id]))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.theirs.refresh_from_db()
        self.assertFalse(self.theirs.read)

    def test_mark_all_as_read(self):
        res = self.client.patch(reverse("mark_all_unread_notifications_as_read"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(Notification.objects.filter(user=self.user, read=False).exists())
        self.assertFalse(Notification.objects.get(id=self.theirs.id).read)

    def test_anonymous_rejected(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.patch(reverse("mark_all_unread_notifications_as_read")).status_code, 401)


# ---------------------------------------------------------------------------
# Ready-driver count
# ---------------------------------------------------------------------------
@mock.patch("api.features.booking.helpers.driver_availability.broadcast")
class DriverAvailabilityTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.toda = make_toda()
        self.station = make_station(self.toda)

    def test_count_only_includes_drivers_who_can_be_offered(self, broadcast):
        queue_driver(make_driver(self.toda, self.station))
        queue_driver(make_driver(self.toda, self.station, status="BLACKLISTED"))
        queue_driver(make_driver(self.toda, self.station, verified=False))
        make_driver(self.toda, self.station)  # active but not queued
        self.assertEqual(count_ready_drivers(), 1)
        self.assertEqual(driver_availability_payload(), {"ready_drivers": 1})

    def test_queueing_broadcasts_new_count_to_passengers(self, broadcast):
        driver = make_driver(self.toda, self.station)
        self.client.force_authenticate(driver.user)

        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse("driver-queue"), PICKUP, format="json")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        broadcast.assert_called_once_with(PASSENGERS_ONLINE_GROUP, "driver_availability", {"ready_drivers": 1})

    def test_dequeueing_broadcasts_zero(self, broadcast):
        driver = make_driver(self.toda, self.station)
        queue_driver(driver)
        self.client.force_authenticate(driver.user)

        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.delete(reverse("driver-dequeue"))

        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        broadcast.assert_called_once_with(PASSENGERS_ONLINE_GROUP, "driver_availability", {"ready_drivers": 0})

    def test_failed_queue_attempt_does_not_broadcast(self, broadcast):
        driver = make_driver(self.toda, self.station)
        queue_driver(driver)
        broadcast.reset_mock()
        self.client.force_authenticate(driver.user)

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse("driver-queue"), PICKUP, format="json")

        broadcast.assert_not_called()

    def test_removing_a_queue_row_lowers_the_count(self, broadcast):
        """offer_driver deletes the row when a booking is offered, same as this."""
        driver = make_driver(self.toda, self.station)
        queue_driver(driver)
        broadcast.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            DriverQueue.objects.filter(driver=driver).delete()

        broadcast.assert_called_once_with(PASSENGERS_ONLINE_GROUP, "driver_availability", {"ready_drivers": 0})


# ---------------------------------------------------------------------------
# Notification type + booking (used by the app to pick a redirect)
# ---------------------------------------------------------------------------
class NotificationTypeTests(LayerMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.toda = make_toda()
        self.station = make_station(self.toda)
        self.passenger = make_passenger()
        self.driver = make_driver(self.toda, self.station)
        self.booking = make_booking(self.passenger, self.driver)

    def only(self, user):
        return Notification.objects.get(user=user)

    def test_each_trigger_sets_its_type_and_booking(self):
        notify_booking_accepted(self.booking)
        self.assertEqual(
            (self.only(self.passenger.user).type, self.only(self.passenger.user).booking_id),
            (Notification.Type.BOOKING_ACCEPTED, self.booking.id),
        )
        Notification.objects.all().delete()

        notify_if_driver_nearby(self.booking.id, PICKUP["lat"], PICKUP["lng"])
        self.assertEqual(self.only(self.passenger.user).type, Notification.Type.DRIVER_NEARBY)
        self.assertEqual(self.only(self.passenger.user).booking_id, self.booking.id)
        Notification.objects.all().delete()

        with mock.patch("api.features.chat.signals.broadcast"):
            Message.objects.create(booking=self.booking, sender=self.passenger.user, receiver=self.driver.user, message="hi")
        self.assertEqual(self.only(self.driver.user).type, Notification.Type.NEW_MESSAGE)
        self.assertEqual(self.only(self.driver.user).booking_id, self.booking.id)
        Notification.objects.all().delete()

        with mock.patch("api.features.reports.signals.get_channel_layer", return_value=None):
            IncidentReport.objects.create(booking=self.booking, reported_by=self.passenger.user, location=point(PICKUP))
        self.assertEqual(self.only(self.driver.user).type, Notification.Type.REPORTED)

    def test_default_type_is_general(self):
        notification = create_notification(self.passenger.user, "Welcome")
        self.assertEqual(notification.type, Notification.Type.GENERAL)
        self.assertIsNone(notification.booking_id)

    def test_socket_payload_has_type_and_booking_status(self):
        with self.captureOnCommitCallbacks(execute=True):
            notify_booking_accepted(self.booking)
        payload = self.layer.sent[0][1]["notification"]
        self.assertEqual(payload["type"], "booking_accepted")
        self.assertEqual(payload["booking_id"], self.booking.id)
        self.assertEqual(payload["booking_status"], "accepted")

    def test_rest_list_has_type_and_current_booking_status(self):
        notify_booking_accepted(self.booking)
        create_notification(self.passenger.user, "No booking")
        Booking.objects.filter(id=self.booking.id).update(status=Booking.Status.COMPLETED)
        self.client.force_authenticate(self.passenger.user)

        res = self.client.get(reverse("get_user_notification"))

        by_type = {n["type"]: n for n in res.data}
        self.assertEqual(by_type["booking_accepted"]["booking_id"], self.booking.id)
        self.assertEqual(by_type["booking_accepted"]["booking_status"], "completed")
        self.assertIsNone(by_type["general"]["booking_id"])
        self.assertIsNone(by_type["general"]["booking_status"])

    def test_deleting_the_booking_keeps_the_notification(self):
        notify_booking_accepted(self.booking)
        # IncidentReport protects bookings, but none exist here
        self.booking.delete()
        notification = self.only(self.passenger.user)
        self.assertIsNone(notification.booking_id)
        self.assertEqual(notification.type, Notification.Type.BOOKING_ACCEPTED)
