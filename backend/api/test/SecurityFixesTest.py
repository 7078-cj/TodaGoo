"""Tests for the fixes listed in SECURITY_FIXES.md."""
from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from api.features.booking.helpers.offer_guard import is_booking_offered_to
from api.features.utils.password_reset import (
    RESET_LOCKED, RESET_OK, check_reset_code, issue_reset_code,
)
from api.features.utils.security import (
    get_user_by_email, initial_driver_status, parse_lat_lng,
    require_current_password, validate_booking_payload,
)
from api.features.utils.uploads import validate_file_count, validate_file_size
from websocket.auth import get_token_from_scope

STRONG_PASSWORD = "N3w-Str0ng!Passw0rd"


class PasswordResetTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user("resetme", "reset@example.com", "Old-Passw0rd!x")

    def test_unknown_email_gets_same_reply(self):
        known = self.client.post(reverse("request_password_reset"), {"email": "reset@example.com"})
        cache.clear()
        unknown = self.client.post(reverse("request_password_reset"), {"email": "nobody@example.com"})
        self.assertEqual(known.status_code, 200)
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.data, unknown.data)

    def test_code_is_six_digits_and_emailed(self):
        self.client.post(reverse("request_password_reset"), {"email": "reset@example.com"})
        self.assertEqual(len(mail.outbox), 1)
        code = mail.outbox[0].body.rsplit(" ", 1)[-1]
        self.assertRegex(code, r"^\d{6}$")

    def test_wrong_guesses_lock_the_code(self):
        code = issue_reset_code(self.user)
        for _ in range(5):
            result = check_reset_code(self.user, "000000" if code != "000000" else "111111")
        self.assertEqual(result, RESET_LOCKED)
        self.assertNotEqual(check_reset_code(self.user, code), RESET_OK)

    def test_weak_password_rejected(self):
        code = issue_reset_code(self.user)
        res = self.client.post(
            reverse("reset_password"),
            {"email": "reset@example.com", "code": code, "password": "123"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("password", res.data)

    def test_reset_changes_password_and_blacklists_tokens(self):
        refresh = RefreshToken.for_user(self.user)
        code = issue_reset_code(self.user)
        res = self.client.post(
            reverse("reset_password"),
            {"email": "reset@example.com", "code": code, "password": STRONG_PASSWORD},
        )
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(STRONG_PASSWORD))
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists())

    def test_duplicate_email_is_ambiguous(self):
        User.objects.create_user("twin", "reset@example.com", "Twin-Passw0rd!x")
        self.assertIsNone(get_user_by_email("reset@example.com"))
        self.assertIsNone(get_user_by_email(""))


class DefaultPermissionTests(APITestCase):
    def test_anonymous_notifications_rejected(self):
        res = self.client.get(reverse("get_user_notification"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class CurrentPasswordTests(TestCase):
    def test_password_change_requires_current_password(self):
        user = User.objects.create_user("pw", password="Old-Passw0rd!x")
        self.assertFalse(require_current_password(user, {"first_name": "x"}))
        with self.assertRaises(ValidationError):
            require_current_password(user, {"password": STRONG_PASSWORD})
        with self.assertRaises(ValidationError):
            require_current_password(user, {"password": STRONG_PASSWORD, "current_password": "wrong"})
        self.assertTrue(
            require_current_password(user, {"password": STRONG_PASSWORD, "current_password": "Old-Passw0rd!x"})
        )


class UtilityTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_offer_guard(self):
        cache.set("driver_7_booking", {"id": 42}, 30)
        self.assertTrue(is_booking_offered_to(7, 42))
        self.assertTrue(is_booking_offered_to(7, "42"))
        self.assertFalse(is_booking_offered_to(7, 43))
        self.assertFalse(is_booking_offered_to(8, 42))

    def test_parse_lat_lng(self):
        self.assertEqual(parse_lat_lng({"lat": "14.5", "lng": 121}), (14.5, 121.0))
        self.assertIsNone(parse_lat_lng({"lat": 200, "lng": 0}))
        self.assertIsNone(parse_lat_lng({"lat": "x", "lng": 0}))
        self.assertIsNone(parse_lat_lng(None))

    @override_settings(MAX_BOOKING_STOPS=2, MAX_ROUTES_JSON_BYTES=50)
    def test_booking_payload_limits(self):
        validate_booking_payload([{}, {}], {"a": 1})
        with self.assertRaises(ValidationError):
            validate_booking_payload([{}, {}, {}], None)
        with self.assertRaises(ValidationError):
            validate_booking_payload(None, {"coords": "x" * 100})

    @override_settings(MAX_UPLOAD_SIZE_MB=1, MAX_EVIDENCE_FILES=2)
    def test_upload_limits(self):
        small = SimpleUploadedFile("a.png", b"x" * 10)
        big = SimpleUploadedFile("b.png", b"x" * (1024 * 1024 + 1))
        validate_file_size(small)
        with self.assertRaises(serializers.ValidationError):
            validate_file_size(big)
        with self.assertRaises(serializers.ValidationError):
            validate_file_count([small, small, small])

    def test_driver_signup_status_toggle(self):
        with override_settings(DRIVER_SIGNUP_REQUIRES_APPROVAL=True):
            self.assertEqual(initial_driver_status(), "PENDING")
        with override_settings(DRIVER_SIGNUP_REQUIRES_APPROVAL=False):
            self.assertEqual(initial_driver_status(), "ACTIVE")

    def test_ws_token_from_subprotocol(self):
        scope = {"subprotocols": ["access_token", "abc.def.ghi"], "query_string": b"token=fromurl"}
        self.assertEqual(get_token_from_scope(scope), "abc.def.ghi")

    def test_ws_query_token_only_when_allowed(self):
        scope = {"subprotocols": [], "query_string": b"token=fromurl"}
        with override_settings(WS_ALLOW_QUERY_TOKEN=False):
            self.assertIsNone(get_token_from_scope(scope))
        with override_settings(WS_ALLOW_QUERY_TOKEN=True):
            self.assertEqual(get_token_from_scope(scope), "fromurl")
