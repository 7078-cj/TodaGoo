"""Chat (send / list / mark seen) and incident report (create / list / status update) endpoints."""
from datetime import timedelta
from unittest import mock

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.features.booking.models import Booking
from api.features.chat.models import Message
from api.features.reports.models import IncidentReport

from .factories import PICKUP, idem, make_admin, make_booking, make_driver, make_passenger, make_station, make_toda

MESSAGES = "message"
MESSAGES_SEEN = "message-seen"
REPORTS = "incident-report-list-create"
REPORT_DETAIL = "incident-report-retrieve-update"


class ParticipantsBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.toda = make_toda()
        self.station = make_station(self.toda)
        self.passenger = make_passenger()
        self.driver = make_driver(self.toda, self.station)
        self.booking = make_booking(self.passenger, self.driver)

    def as_user(self, user):
        self.client.force_authenticate(user)


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
@mock.patch("api.features.chat.signals.broadcast")
class ChatTests(ParticipantsBase):
    def send(self, user, text="Hello", booking_id=None):
        self.as_user(user)
        return self.client.post(
            reverse(MESSAGES), {"booking_id": booking_id or self.booking.id, "message": text}, format="json"
        )

    def test_passenger_message_goes_to_driver_and_is_broadcast(self, broadcast):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.send(self.passenger.user, "On my way down")

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["sender"], self.passenger.user.id)
        self.assertEqual(res.data["receiver"], self.driver.user.id)
        self.assertFalse(res.data["seen"])
        channel, event, data = broadcast.call_args[0]
        self.assertEqual((channel, event, data["id"]), (f"booking_{self.booking.id}", "chat_message", res.data["id"]))

    def test_driver_message_goes_to_passenger(self, broadcast):
        res = self.send(self.driver.user)
        self.assertEqual(res.data["receiver"], self.passenger.user.id)

    def test_participants_list_conversation_in_order(self, broadcast):
        self.send(self.passenger.user, "first")
        self.send(self.driver.user, "second")
        self.as_user(self.passenger.user)

        res = self.client.get(reverse(MESSAGES), {"booking_id": self.booking.id})

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([m["message"] for m in res.data], ["first", "second"])

    def test_mark_seen_only_marks_messages_received(self, broadcast):
        self.send(self.passenger.user, "to driver")
        self.send(self.driver.user, "to passenger")
        self.as_user(self.driver.user)

        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(reverse(MESSAGES_SEEN), {"booking_id": self.booking.id}, format="json")

        to_driver = Message.objects.get(message="to driver")
        self.assertEqual(res.data["seen_ids"], [to_driver.id])
        self.assertTrue(to_driver.seen)
        self.assertFalse(Message.objects.get(message="to passenger").seen)
        self.assertEqual(broadcast.call_args[0][1], "messages_seen")

    def test_mark_seen_with_nothing_new(self, broadcast):
        self.as_user(self.driver.user)
        res = self.client.post(reverse(MESSAGES_SEEN), {"booking_id": self.booking.id}, format="json")
        self.assertEqual(res.data, {"seen_ids": []})

    def test_outsider_cannot_send_or_read(self, broadcast):
        outsider = make_passenger().user
        self.assertEqual(self.send(outsider).status_code, status.HTTP_403_FORBIDDEN)
        res = self.client.get(reverse(MESSAGES), {"booking_id": self.booking.id})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        res = self.client.post(reverse(MESSAGES_SEEN), {"booking_id": self.booking.id}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_booking_id_required(self, broadcast):
        self.as_user(self.passenger.user)
        self.assertEqual(
            self.client.post(reverse(MESSAGES), {"message": "hi"}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(self.client.get(reverse(MESSAGES)).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.client.post(reverse(MESSAGES_SEEN), {}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_chat_closed_once_ride_is_completed(self, broadcast):
        self.booking.status = Booking.Status.COMPLETED
        self.booking.save()
        self.assertEqual(self.send(self.passenger.user).status_code, status.HTTP_404_NOT_FOUND)

    def test_pending_booking_without_driver_has_no_chat(self, broadcast):
        pending = make_booking(make_passenger(), status=Booking.Status.PENDING)
        self.assertEqual(self.send(pending.passenger.user, booking_id=pending.id).status_code, status.HTTP_404_NOT_FOUND)

    def test_message_too_long(self, broadcast):
        self.assertEqual(self.send(self.passenger.user, "x" * 301).status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_rejected(self, broadcast):
        res = self.client.get(reverse(MESSAGES), {"booking_id": self.booking.id})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# Incident reports
# ---------------------------------------------------------------------------
@mock.patch("api.features.reports.signals.get_channel_layer", return_value=None)
class IncidentReportTests(ParticipantsBase):
    def report(self, user, incident="overcharging", booking_id=None, **extra):
        self.as_user(user)
        body = {
            "booking_id": booking_id or self.booking.id,
            "location": PICKUP,
            "incident_types": incident,
            "injured_party": "none",
            "details": "Charged twice the fare",
            **extra,
        }
        return self.client.post(reverse(REPORTS), body, format="json", **idem())

    def test_passenger_files_report(self, _layer):
        res = self.report(self.passenger.user)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["status"], "open")
        self.assertEqual(res.data["reported_by"], self.passenger.user.id)
        self.assertEqual(res.data["location"], PICKUP)

    def test_driver_files_report(self, _layer):
        self.assertEqual(self.report(self.driver.user, "harassment").status_code, status.HTTP_201_CREATED)

    def test_outsider_cannot_report(self, _layer):
        self.assertEqual(self.report(make_passenger().user).status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_booking(self, _layer):
        self.assertEqual(self.report(self.passenger.user, booking_id=999999).status_code, status.HTTP_404_NOT_FOUND)

    def test_report_window_closes_after_three_days(self, _layer):
        Booking.objects.filter(id=self.booking.id).update(created_at=timezone.now() - timedelta(days=4))
        res = self.report(self.passenger.user)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_toda_admin_can_report_old_booking(self, _layer):
        Booking.objects.filter(id=self.booking.id).update(created_at=timezone.now() - timedelta(days=4))
        self.assertEqual(self.report(make_admin("TODA")).status_code, status.HTTP_201_CREATED)

    def test_invalid_payload(self, _layer):
        self.assertEqual(self.report(self.passenger.user, "not_a_type").status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.report(self.passenger.user, location="nowhere").status_code, status.HTTP_400_BAD_REQUEST
        )

    def test_reporter_lists_only_own_reports(self, _layer):
        self.report(self.passenger.user)
        self.report(self.driver.user)
        self.as_user(self.passenger.user)
        res = self.client.get(reverse(REPORTS))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["results"]), 1)

    def test_mdrrmo_sees_only_its_incident_types(self, _layer):
        self.report(self.passenger.user, "overcharging")
        self.report(self.passenger.user, "accident")
        self.as_user(make_admin("MDRRMO"))
        res = self.client.get(reverse(REPORTS))
        self.assertEqual([r["incident_types"] for r in res.data["results"]], ["accident"])

    def test_list_filter_validation(self, _layer):
        self.as_user(self.passenger.user)
        self.assertEqual(self.client.get(reverse(REPORTS), {"status": "bogus"}).status_code, 400)
        self.assertEqual(self.client.get(reverse(REPORTS), {"toda_boundary": self.toda.id}).status_code, 400)

    def test_toda_admin_resolves_report(self, _layer):
        report_id = self.report(self.passenger.user).data["id"]
        self.as_user(make_admin("TODA"))
        res = self.client.patch(reverse(REPORT_DETAIL, args=[report_id]), {"status": "resolved"}, format="json", **idem())
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(IncidentReport.objects.get(id=report_id).status, "resolved")

    def test_admin_can_only_change_status(self, _layer):
        report_id = self.report(self.passenger.user).data["id"]
        self.as_user(make_admin("TODA"))
        res = self.client.patch(
            reverse(REPORT_DETAIL, args=[report_id]), {"status": "resolved", "details": "edited"}, format="json", **idem()
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("details", res.data["unauthorized_fields"])

    def test_reporter_cannot_change_status(self, _layer):
        report_id = self.report(self.passenger.user).data["id"]
        res = self.client.patch(reverse(REPORT_DETAIL, args=[report_id]), {"status": "dismissed"}, format="json", **idem())
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_mdrrmo_cannot_see_toda_only_report(self, _layer):
        report_id = self.report(self.passenger.user, "overcharging").data["id"]
        self.as_user(make_admin("MDRRMO"))
        res = self.client.patch(reverse(REPORT_DETAIL, args=[report_id]), {"status": "resolved"}, format="json", **idem())
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
