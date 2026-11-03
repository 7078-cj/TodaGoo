"""What the mobile Profile screen relies on: `me/` (incl. rating), profile updates sent the way the
app sends them (multipart with flat 'passenger_profile.x' keys + photo), and change-password."""
import io
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from api.features.utils import password_change

from .factories import PASSWORD, make_driver, make_passenger, make_station, make_toda

NEW_PASSWORD = "Br4nd-New!Passw0rd"


def png(name="photo.png"):
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), "orange").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class ProfileBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.passenger = make_passenger(rating=4.5)
        toda = make_toda()
        self.driver = make_driver(toda, make_station(toda), rating=3.25)


# ---------------------------------------------------------------------------
# me/ + updates
# ---------------------------------------------------------------------------
class ProfileMeTests(ProfileBase):
    def test_passenger_me_includes_rating(self):
        self.client.force_authenticate(self.passenger.user)
        res = self.client.get(reverse("passenger-profile"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(float(res.data["passenger_profile"]["rating"]), 4.5)

    def test_driver_me_includes_rating(self):
        self.client.force_authenticate(self.driver.user)
        res = self.client.get(reverse("driver-profile"))
        self.assertEqual(float(res.data["driver_profile"]["rating"]), 3.25)

    def test_rating_cannot_be_set_through_update(self):
        user = self.passenger.user
        self.client.force_authenticate(user)
        res = self.client.patch(
            reverse("retrieve_update_delete_passenger", args=[user.id]),
            {"passenger_profile": {"rating": 5}},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.passenger.refresh_from_db()
        self.assertEqual(float(self.passenger.rating), 4.5)


class ProfileUpdateFromAppTests(ProfileBase):
    """The app sends multipart with flat keys (utils/requests.js buildFormData)."""

    def test_passenger_updates_details_and_photo(self):
        user = self.passenger.user
        self.client.force_authenticate(user)
        res = self.client.patch(
            reverse("retrieve_update_delete_passenger", args=[user.id]),
            {
                "first_name": "Mary",
                "last_name": "Garcia",
                "passenger_profile.address": "123 A. Bonifacio Street",
                "passenger_profile.contact_number": "09111111111",
                "passenger_profile.emergency_contact_name": "Susan Dela Cruz",
                "passenger_profile.emergency_contact_number": "09222222222",
                "passenger_profile.profile_picture": png(),
            },
            format="multipart",
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.passenger.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual((user.first_name, user.last_name), ("Mary", "Garcia"))
        self.assertEqual(self.passenger.emergency_contact_name, "Susan Dela Cruz")
        self.assertTrue(self.passenger.profile_picture.name.startswith("passenger_profiles/"))

    def test_driver_updates_address_and_contact(self):
        user = self.driver.user
        self.client.force_authenticate(user)
        res = self.client.patch(
            reverse("retrieve_update_delete_driver", args=[user.id]),
            {"driver_profile.address": "New Driver Address", "driver_profile.contact_number": "09333333333"},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.driver.refresh_from_db()
        self.assertEqual(self.driver.contact_number, "09333333333")

    def test_invalid_values_return_field_errors(self):
        user = self.passenger.user
        self.client.force_authenticate(user)
        res = self.client.patch(
            reverse("retrieve_update_delete_passenger", args=[user.id]),
            {"passenger_profile.contact_number": "123", "passenger_profile.address": "x"},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("passenger_profile", res.data)

    def test_cannot_update_someone_else(self):
        self.client.force_authenticate(make_passenger().user)
        res = self.client.patch(
            reverse("retrieve_update_delete_passenger", args=[self.passenger.user.id]),
            {"first_name": "Hacked"},
            format="multipart",
        )
        self.assertIn(res.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))


# ---------------------------------------------------------------------------
# change-password
# ---------------------------------------------------------------------------
class ChangePasswordTests(ProfileBase):
    URL = "change_password"

    def setUp(self):
        super().setUp()
        self.user = self.passenger.user
        self.client.force_authenticate(self.user)

    def change(self, **body):
        return self.client.post(reverse(self.URL), body, format="json")

    def test_changes_password_and_returns_working_tokens(self):
        old_session = RefreshToken.for_user(self.user)

        res = self.change(current_password=PASSWORD, new_password=NEW_PASSWORD)

        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))
        # other sessions are signed out...
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=old_session["jti"]).exists())
        # ...but this device gets a fresh, valid pair with the role claim the app reads
        self.assertFalse(BlacklistedToken.objects.filter(token__jti=RefreshToken(res.data["refresh"])["jti"]).exists())
        self.assertEqual(RefreshToken(res.data["refresh"])["role"], "passenger")
        self.client.force_authenticate(None)
        refreshed = self.client.post(reverse("token_refresh"), {"refresh": res.data["refresh"]}, format="json")
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK)

    def test_can_log_in_with_new_password_only(self):
        self.change(current_password=PASSWORD, new_password=NEW_PASSWORD)
        self.client.force_authenticate(None)
        login = lambda pw: self.client.post(
            reverse("token_obtain_pair"), {"username": self.user.username, "password": pw}, format="json"
        )
        self.assertEqual(login(NEW_PASSWORD).status_code, status.HTTP_200_OK)
        self.assertEqual(login(PASSWORD).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_wrong_or_missing_current_password(self):
        for body in ({"current_password": "wrong", "new_password": NEW_PASSWORD}, {"new_password": NEW_PASSWORD}):
            res = self.change(**body)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, body)
            self.assertIn("current_password", res.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_new_password_rules(self):
        cases = {
            "missing": {},
            "same as current": {"new_password": PASSWORD},
            "too weak": {"new_password": "123"},
        }
        for label, extra in cases.items():
            res = self.change(current_password=PASSWORD, **extra)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, label)
            self.assertIn("new_password", res.data, label)

    def test_driver_can_change_password(self):
        self.client.force_authenticate(self.driver.user)
        res = self.change(current_password=PASSWORD, new_password=NEW_PASSWORD)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(RefreshToken(res.data["refresh"])["role"], "driver")

    def test_anonymous_rejected(self):
        self.client.force_authenticate(None)
        res = self.change(current_password=PASSWORD, new_password=NEW_PASSWORD)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_attempts_are_throttled(self):
        with mock.patch("api.features.user.views.PasswordChangeThrottle.get_rate", return_value="2/hour"):
            codes = [self.change(current_password="wrong", new_password=NEW_PASSWORD).status_code for _ in range(3)]
        self.assertEqual(codes, [400, 400, 429])

    def test_verifier_is_pluggable(self):
        """How OTP will plug in: register a verifier and point the setting at it."""
        def verify_otp(user, data):
            if data.get("otp") != "123456":
                raise ValidationError({"otp": "Invalid code."})

        with mock.patch.dict(password_change.VERIFIERS, {"otp": verify_otp}), \
                override_settings(PASSWORD_CHANGE_VERIFIER="otp"):
            bad = self.change(otp="000000", new_password=NEW_PASSWORD)
            good = self.change(otp="123456", new_password=NEW_PASSWORD)

        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("otp", bad.data)
        self.assertEqual(good.status_code, status.HTTP_200_OK, good.data)
