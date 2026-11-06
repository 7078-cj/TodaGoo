"""
Forgot password in the app, by SMS code: api/features/utils/sms_password_reset.py and
api/features/user/sms_reset_views.py (user/sms-reset/request|verify|confirm/).

- No SMS is sent: utils.otp.send_otp is replaced by a recorder (SmsOutbox) in every test.
- Time is controlled: FakeClock replaces time.time, which the cache uses for expiry, so 5-minute
  codes and 60-second cooldowns are tested without waiting.
- An in-memory cache, cleared per test; the test database is rolled back per test.
"""
import logging
import re
from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from api.features.user.models import Admin, Driver, Passenger
from api.features.utils import sms_password_reset as reset
from api.features.utils.otp import generate_otp
from api.features.utils.validation import normalize_ph_mobile

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "sms-reset-tests"}}
OLD_PASSWORD = "Old-Passw0rd!x"
NEW_PASSWORD = "N3w-Secret!pass"
PHONE = "09171234567"

REQUEST = "sms_reset_request"
VERIFY = "sms_reset_verify"
CONFIRM = "sms_reset_confirm"
LOGIN = "token_obtain_pair"


class FakeClock:
    """time.time() under the test's control (the cache's expiry clock)."""

    def __init__(self, start=1_800_000_000.0):
        self.now = start

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class SmsOutbox:
    """Stands in for utils.otp.send_otp: records (number, code) instead of sending."""

    def __init__(self):
        self.sent = []
        self.fail = False

    def __call__(self, number, code):
        if self.fail:
            raise ConnectionError("SMS provider unavailable")
        self.sent.append((number, code))

    @property
    def last_code(self):
        return self.sent[-1][1]


def make_passenger_with(phone=PHONE, username="maria", password=OLD_PASSWORD, **user_fields):
    user = User.objects.create_user(username, password=password, **user_fields)
    Passenger.objects.create(
        user=user, address="Malolos, Bulacan", contact_number=phone,
        emergency_contact_name="Jose", emergency_contact_number="09179999999", verified=True,
    )
    return user


def make_driver_with(phone, username="pedro", password=OLD_PASSWORD):
    user = User.objects.create_user(username, password=password)
    Driver.objects.create(
        user=user, address="Malolos, Bulacan", contact_number=phone, toda_number="01-001",
        vehicle_plate=f"TRY{phone[-4:]}", verified=True, status="ACTIVE",
    )
    return user


class ResetTestMixin:
    """Fake clock + SMS outbox + clean cache for every test."""

    def setUp(self):
        super().setUp()
        self.clock = FakeClock()
        self.sms = SmsOutbox()
        for patcher in (mock.patch("time.time", self.clock), mock.patch("api.features.utils.otp.send_otp", self.sms)):
            patcher.start()
            self.addCleanup(patcher.stop)
        cache.clear()
        self.addCleanup(cache.clear)


# =============================================================================
# Unit: phone numbers
# =============================================================================
class PhoneNormalizationTests(SimpleTestCase):
    def test_accepts_the_ways_people_type_a_ph_mobile_number(self):
        for raw in ["09171234567", "0917 123 4567", "0917-123-4567", "+63 917 123 4567", "639171234567", "9171234567"]:
            with self.subTest(raw=raw):
                self.assertEqual(normalize_ph_mobile(raw), PHONE)

    def test_rejects_anything_else(self):
        for raw in ["", None, "12345", "08171234567", "091712345678", "0917123456", "+1 917 123 4567", "abc"]:
            with self.subTest(raw=raw):
                self.assertIsNone(normalize_ph_mobile(raw))


# =============================================================================
# Unit: codes and hashing
# =============================================================================
class CodeTests(SimpleTestCase):
    @override_settings(ENVIRONMENT="production")
    def test_codes_are_six_random_digits(self):
        codes = [generate_otp() for _ in range(300)]
        for code in codes:
            self.assertRegex(code, r"^\d{6}$")
        self.assertGreater(len(set(codes)), 290)  # 300 draws from a million: (almost) no repeats

    @override_settings(ENVIRONMENT="development")
    def test_development_uses_the_fixed_dev_code(self):
        self.assertEqual(generate_otp(), "111111")

    def test_hash_verifies_only_the_same_code_for_the_same_number(self):
        stored = reset.hash_code(PHONE, "123456")
        self.assertNotIn("123456", stored)
        self.assertTrue(reset.code_matches(PHONE, "123456", stored))
        self.assertTrue(reset.code_matches(PHONE, " 123456 ", stored))
        self.assertFalse(reset.code_matches(PHONE, "123457", stored))
        self.assertFalse(reset.code_matches("09170000000", "123456", stored))
        self.assertFalse(reset.code_matches(PHONE, "", stored))
        self.assertFalse(reset.code_matches(PHONE, "123456", None))


# =============================================================================
# Unit: expiry, attempts, single use, reset tokens
# =============================================================================
@override_settings(CACHES=LOCMEM, ENVIRONMENT="production")
class ResetLogicTests(ResetTestMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.user = make_passenger_with()

    def test_code_is_stored_hashed_not_in_plain_text(self):
        self.assertEqual(reset.request_code(PHONE), reset.SENT)
        stored = cache.get(f"sms_reset_code:{PHONE}")
        self.assertEqual(stored["user_id"], self.user.pk)
        self.assertNotIn(self.sms.last_code, str(stored))

    def test_code_expires_after_five_minutes(self):
        reset.request_code(PHONE)
        code = self.sms.last_code
        self.clock.advance(5 * 60 + 1)
        self.assertEqual(reset.verify_code(PHONE, code), (reset.INVALID, None))

    def test_code_still_works_just_before_expiry(self):
        reset.request_code(PHONE)
        self.clock.advance(5 * 60 - 1)
        self.assertEqual(reset.verify_code(PHONE, self.sms.last_code)[0], reset.VERIFIED)

    def test_five_wrong_codes_lock_and_throw_the_code_away(self):
        reset.request_code(PHONE)
        code = self.sms.last_code
        wrong = "000000" if code != "000000" else "111111"
        results = [reset.verify_code(PHONE, wrong)[0] for _ in range(5)]
        self.assertEqual(results, [reset.INVALID] * 4 + [reset.LOCKED])
        self.assertEqual(reset.verify_code(PHONE, code)[0], reset.LOCKED)  # the right code is dead too

    def test_a_new_code_after_a_lock_gets_fresh_attempts(self):
        reset.request_code(PHONE)
        for _ in range(5):
            reset.verify_code(PHONE, "000000")
        self.clock.advance(61)
        reset.request_code(PHONE)
        self.assertEqual(reset.verify_code(PHONE, self.sms.last_code)[0], reset.VERIFIED)

    def test_a_code_works_only_once(self):
        reset.request_code(PHONE)
        code = self.sms.last_code
        self.assertEqual(reset.verify_code(PHONE, code)[0], reset.VERIFIED)
        self.assertEqual(reset.verify_code(PHONE, code), (reset.INVALID, None))

    def test_a_new_code_replaces_the_old_one(self):
        reset.request_code(PHONE)
        first = self.sms.last_code
        self.clock.advance(61)
        reset.request_code(PHONE)
        if first != self.sms.last_code:
            self.assertEqual(reset.verify_code(PHONE, first)[0], reset.INVALID)

    def test_reset_token_is_random_and_belongs_to_the_user(self):
        t1, t2 = reset.issue_reset_token(self.user), reset.issue_reset_token(self.user)
        self.assertNotEqual(t1, t2)
        self.assertGreaterEqual(len(t1), 40)
        self.assertEqual(reset.user_for_token(t1), self.user)
        self.assertIsNone(reset.user_for_token("made-up"))
        self.assertIsNone(reset.user_for_token(None))

    def test_reset_token_is_stored_only_as_a_hash(self):
        token = reset.issue_reset_token(self.user)
        self.assertIsNone(cache.get(f"sms_reset_token:{token}"))

    def test_reset_token_expires_after_ten_minutes(self):
        token = reset.issue_reset_token(self.user)
        self.clock.advance(10 * 60 + 1)
        self.assertIsNone(reset.user_for_token(token))

    def test_reset_token_of_a_deactivated_user_is_refused(self):
        token = reset.issue_reset_token(self.user)
        User.objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(reset.reset_password(token, NEW_PASSWORD), reset.TOKEN_INVALID)

    def test_number_shared_by_two_accounts_resets_neither(self):
        make_driver_with(PHONE)
        self.assertIsNone(reset.find_user_by_phone(PHONE))
        self.assertEqual(reset.request_code(PHONE), reset.NO_ACCOUNT)
        self.assertEqual(self.sms.sent, [])

    def test_admin_accounts_are_never_found_by_number(self):
        Admin.objects.create(user=self.user, department="TODA")
        self.assertIsNone(reset.find_user_by_phone(PHONE))

    def test_drivers_can_reset_too(self):
        driver = make_driver_with("09181112222")
        self.assertEqual(reset.find_user_by_phone("09181112222"), driver)


# =============================================================================
# API: request a code
# =============================================================================
@override_settings(CACHES=LOCMEM, ENVIRONMENT="production")
class RequestCodeApiTests(ResetTestMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = make_passenger_with()

    def post(self, phone):
        return self.client.post(reverse(REQUEST), {"phone": phone}, format="json")

    def test_success_sends_one_sms_to_the_stored_number(self):
        res = self.post("+63 917 123 4567")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["retry_after"], 60)
        self.assertEqual(len(self.sms.sent), 1)
        number, code = self.sms.sent[0]
        self.assertEqual(number, PHONE)
        self.assertRegex(code, r"^\d{6}$")
        self.assertNotIn(code, str(res.data))

    def test_unknown_number_says_no_account_and_sends_no_sms(self):
        res = self.post("09990000000")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(res.data["error"], "No account is registered with this number.")
        self.assertEqual(self.sms.sent, [])

    def test_invalid_format(self):
        res = self.post("12345")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", res.data)
        self.assertEqual(self.sms.sent, [])

    def test_missing_number(self):
        self.assertEqual(self.client.post(reverse(REQUEST), {}, format="json").status_code, status.HTTP_400_BAD_REQUEST)

    def test_resend_cooldown_is_sixty_seconds(self):
        self.post(PHONE)
        res = self.post(PHONE)
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(res.data["retry_after"], 60)
        self.clock.advance(59)
        self.assertEqual(self.post(PHONE).status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.clock.advance(2)
        self.assertEqual(self.post(PHONE).status_code, status.HTTP_200_OK)
        self.assertEqual(len(self.sms.sent), 2)

    def test_at_most_three_codes_an_hour_per_number(self):
        for _ in range(3):
            self.assertEqual(self.post(PHONE).status_code, status.HTTP_200_OK)
            self.clock.advance(61)
        res = self.post(PHONE)
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Try again in an hour", res.data["error"])
        self.assertEqual(len(self.sms.sent), 3)
        self.clock.advance(60 * 60)
        self.assertEqual(self.post(PHONE).status_code, status.HTTP_200_OK)

    def test_unknown_number_starts_no_cooldown(self):
        self.post("09990000000")
        self.assertEqual(self.post("09990000000").status_code, status.HTTP_404_NOT_FOUND)

    def test_sms_failure_says_so_and_allows_an_immediate_retry(self):
        self.sms.fail = True
        with mock.patch("api.features.utils.otp.generate_otp", return_value="482913"), \
                self.assertLogs("api.features.utils.sms_password_reset", level="ERROR") as logs:
            res = self.post(PHONE)
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("couldn't send", res.data["error"])
        self.assertIsNone(cache.get(f"sms_reset_code:{PHONE}"))  # no code that never arrived
        self.assertNotIn("482913", " ".join(logs.output) + str(res.data))  # the failure log has no code
        self.sms.fail = False
        self.assertEqual(self.post(PHONE).status_code, status.HTTP_200_OK)  # no cooldown after a failure


# =============================================================================
# API: verify the code
# =============================================================================
@override_settings(CACHES=LOCMEM, ENVIRONMENT="production")
class VerifyCodeApiTests(ResetTestMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = make_passenger_with()
        self.client.post(reverse(REQUEST), {"phone": PHONE}, format="json")
        self.code = self.sms.last_code

    def verify(self, code, phone=PHONE):
        return self.client.post(reverse(VERIFY), {"phone": phone, "otp": code}, format="json")

    def wrong(self):
        return "000000" if self.code != "000000" else "111111"

    def test_success_returns_a_reset_token(self):
        res = self.verify(self.code)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["expires_in"], 600)
        self.assertEqual(reset.user_for_token(res.data["reset_token"]), self.user)
        self.assertNotIn(self.code, str(res.data))

    def test_number_can_be_typed_differently_than_at_request(self):
        self.assertEqual(self.verify(self.code, phone="+63 917 123 4567").status_code, status.HTTP_200_OK)

    def test_wrong_code(self):
        res = self.verify(self.wrong())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["error"], "Invalid or expired code.")
        self.assertNotIn("reset_token", res.data)

    def test_expired_code(self):
        self.clock.advance(301)
        res = self.verify(self.code)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["error"], "Invalid or expired code.")

    def test_reused_code(self):
        self.assertEqual(self.verify(self.code).status_code, status.HTTP_200_OK)
        self.assertEqual(self.verify(self.code).status_code, status.HTTP_400_BAD_REQUEST)

    def test_five_wrong_codes_lock_it(self):
        codes = [self.verify(self.wrong()).status_code for _ in range(5)]
        self.assertEqual(codes, [400, 400, 400, 400, 429])
        res = self.verify(self.code)
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(res.data["error"], "Too many wrong attempts. Request a new code.")

    def test_unknown_number_looks_like_a_wrong_code(self):
        res = self.verify("123456", phone="09990000000")
        self.assertEqual((res.status_code, res.data["error"]), (400, "Invalid or expired code."))

    def test_invalid_number_format(self):
        self.assertEqual(self.verify(self.code, phone="12").status_code, status.HTTP_400_BAD_REQUEST)


# =============================================================================
# API: set the new password
# =============================================================================
@override_settings(CACHES=LOCMEM, ENVIRONMENT="production")
class ConfirmResetApiTests(ResetTestMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = make_passenger_with()
        self.client.post(reverse(REQUEST), {"phone": PHONE}, format="json")
        self.token = self.client.post(
            reverse(VERIFY), {"phone": PHONE, "otp": self.sms.last_code}, format="json"
        ).data["reset_token"]

    def confirm(self, token, password=NEW_PASSWORD):
        return self.client.post(reverse(CONFIRM), {"reset_token": token, "password": password}, format="json")

    def login(self, password):
        return self.client.post(reverse(LOGIN), {"username": "maria", "password": password}, format="json")

    def test_success(self):
        res = self.confirm(self.token)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))
        self.assertNotIn(NEW_PASSWORD, str(res.data))

    def test_missing_token(self):
        res = self.client.post(reverse(CONFIRM), {"password": NEW_PASSWORD}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["error"], "Your reset session has expired. Start again.")

    def test_invalid_token(self):
        self.assertEqual(self.confirm("not-a-real-token").status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_token(self):
        self.clock.advance(601)
        self.assertEqual(self.confirm(self.token).status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(OLD_PASSWORD))

    def test_weak_password_rejected_and_token_kept(self):
        for weak in ["123", "password", "alllowercase1!", "NoSymbols123"]:
            with self.subTest(weak=weak):
                res = self.confirm(self.token, weak)
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("password", res.data)
        self.assertEqual(self.confirm(self.token).status_code, status.HTTP_200_OK)  # token still good

    def test_token_cannot_be_reused(self):
        self.assertEqual(self.confirm(self.token).status_code, status.HTTP_200_OK)
        self.assertEqual(self.confirm(self.token, "An0ther!Passw0rd").status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))

    def test_old_password_stops_working_new_one_works(self):
        self.confirm(self.token)
        self.assertEqual(self.login(OLD_PASSWORD).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.login(NEW_PASSWORD).status_code, status.HTTP_200_OK)

    def test_existing_sessions_are_signed_out(self):
        refresh = RefreshToken.for_user(self.user)
        self.confirm(self.token)
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists())
        res = self.client.post(reverse("token_refresh"), {"refresh": str(refresh)}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


# =============================================================================
# End to end, and security checks
# =============================================================================
@override_settings(CACHES=LOCMEM, ENVIRONMENT="production")
class SmsResetEndToEndTests(ResetTestMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = make_passenger_with()

    def test_request_verify_reset_then_log_in_with_the_new_password(self):
        with self.assertLogs(level="DEBUG") as logs:
            r1 = self.client.post(reverse(REQUEST), {"phone": "0917 123 4567"}, format="json")
            code = self.sms.last_code
            r2 = self.client.post(reverse(VERIFY), {"phone": PHONE, "otp": code}, format="json")
            r3 = self.client.post(
                reverse(CONFIRM), {"reset_token": r2.data["reset_token"], "password": NEW_PASSWORD}, format="json"
            )
            r4 = self.client.post(reverse(LOGIN), {"username": "maria", "password": NEW_PASSWORD}, format="json")
            logging.getLogger("api").debug("end of flow")  # so assertLogs always has a record

        self.assertEqual([r.status_code for r in (r1, r2, r3, r4)], [200, 200, 200, 200])
        self.assertIn("access", r4.data)

        # no code or password in any response, nor in anything logged during the flow
        everything = " ".join(str(r.data) for r in (r1, r2, r3)) + " ".join(logs.output)
        self.assertNotIn(code, everything)
        self.assertNotIn(NEW_PASSWORD, everything)
        self.assertNotIn(OLD_PASSWORD, everything)

    def test_new_password_cannot_be_set_without_a_verified_code(self):
        self.client.post(reverse(REQUEST), {"phone": PHONE}, format="json")
        for body in (
            {"password": NEW_PASSWORD},
            {"reset_token": "", "password": NEW_PASSWORD},
            {"reset_token": self.sms.last_code, "password": NEW_PASSWORD},  # the code is not a token
            {"phone": PHONE, "otp": self.sms.last_code, "password": NEW_PASSWORD},
        ):
            with self.subTest(body=body):
                res = self.client.post(reverse(CONFIRM), body, format="json")
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(OLD_PASSWORD))

    def test_a_token_only_resets_its_own_account(self):
        other = make_driver_with("09181112222", username="pedro")
        self.client.post(reverse(REQUEST), {"phone": PHONE}, format="json")
        token = self.client.post(reverse(VERIFY), {"phone": PHONE, "otp": self.sms.last_code}, format="json").data["reset_token"]
        self.client.post(reverse(CONFIRM), {"reset_token": token, "password": NEW_PASSWORD}, format="json")
        other.refresh_from_db()
        self.assertTrue(other.check_password(OLD_PASSWORD))

    def test_code_is_not_logged_outside_development(self):
        with self.assertLogs(level="DEBUG") as logs:
            self.client.post(reverse(REQUEST), {"phone": PHONE}, format="json")
            logging.getLogger("api").debug("marker")
        self.assertFalse(any(re.search(rf"\b{self.sms.last_code}\b", line) for line in logs.output))
