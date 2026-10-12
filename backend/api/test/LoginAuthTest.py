from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.features.user.models import Admin, Driver, Passenger

from .helpers import (
    ADMIN_LOGIN_URL,
    REFRESH_URL,
    USER_LOGIN_URL,
    authenticate,
    decode_access,
    get_access_token,
    get_tokens,
    login,
    logout,
)

PASSWORD = "StrongPass123!"

# Any endpoint that needs an admin token, to prove a login token really works
ADMIN_ONLY_URL = "passenger-list-create"


def make_user(username, **kwargs):
    return User.objects.create_user(username=username, password=PASSWORD, **kwargs)


def make_admin(username="admin", department="TODA"):
    user = make_user(username)
    Admin.objects.create(user=user, department=department)
    return user


def make_passenger(username="passenger"):
    user = make_user(username)
    Passenger.objects.create(
        user=user,
        address="1 Main St",
        contact_number="09171234567",
        emergency_contact_name="Jane Contact",
        emergency_contact_number="09179876543",
    )
    return user


def make_driver(username="driver", vehicle_plate="DRV-001"):
    user = make_user(username)
    Driver.objects.create(
        user=user,
        address="1 Driver St",
        contact_number="09171234567",
        toda_number="01-001",
        vehicle_plate=vehicle_plate,
    )
    return user


class UserLoginTests(APITestCase):
    """POST /token/user, the endpoint passengers and drivers use."""

    def setUp(self):
        cache.clear()  # reset DRF throttle counters between tests
        self.admin = make_admin()
        self.passenger = make_passenger()
        self.driver = make_driver()

    # ---------- success, one per role ----------
    def test_passenger_login_returns_tokens_and_passenger_role(self):
        response = login(self.client, "passenger", PASSWORD)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        claims = decode_access(response.data["access"])
        self.assertEqual(claims["role"], "passenger")
        self.assertEqual(claims["username"], "passenger")
        # simplejwt stores the user id claim as a string
        self.assertEqual(str(claims["user_id"]), str(self.passenger.id))
        self.assertNotIn("department", claims)

    def test_driver_login_returns_tokens_and_driver_role(self):
        response = login(self.client, "driver", PASSWORD)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        claims = decode_access(response.data["access"])
        self.assertEqual(claims["role"], "driver")
        self.assertEqual(claims["username"], "driver")
        self.assertNotIn("department", claims)

    def test_admin_login_on_user_endpoint_returns_admin_role_and_department(self):
        response = login(self.client, "admin", PASSWORD)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        claims = decode_access(response.data["access"])
        self.assertEqual(claims["role"], "admin")
        self.assertEqual(claims["department"], "TODA")

    def test_mdrrmo_admin_department_claim(self):
        make_admin("mdrrmo_admin", department="MDRRMO")
        token = get_access_token(self.client, "mdrrmo_admin", PASSWORD)
        self.assertEqual(decode_access(token)["department"], "MDRRMO")

    def test_user_without_any_profile_gets_unknown_role(self):
        make_user("plain")
        token = get_access_token(self.client, "plain", PASSWORD)
        self.assertEqual(decode_access(token)["role"], "unknown")

    def test_response_does_not_leak_password(self):
        response = login(self.client, "passenger", PASSWORD)
        self.assertNotIn("password", response.data)

    # ---------- failures ----------
    def test_wrong_password_returns_401(self):
        response = login(self.client, "passenger", "wrong-password")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)

    def test_unknown_username_returns_401(self):
        response = login(self.client, "ghost", PASSWORD)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_user_cannot_login(self):
        self.passenger.is_active = False
        self.passenger.save()
        response = login(self.client, "passenger", PASSWORD)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_password_returns_400(self):
        response = self.client.post(
            reverse(USER_LOGIN_URL), {"username": "passenger"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_missing_username_returns_400(self):
        response = self.client.post(
            reverse(USER_LOGIN_URL), {"password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_empty_body_returns_400(self):
        response = self.client.post(reverse(USER_LOGIN_URL), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_not_allowed(self):
        response = self.client.get(reverse(USER_LOGIN_URL))
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_username_is_case_sensitive(self):
        # Django's default auth backend is case-sensitive; this pins that behaviour
        response = login(self.client, "PASSENGER", PASSWORD)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AdminLoginTests(APITestCase):
    """POST /token/admin, meant for the admin dashboard."""

    def setUp(self):
        cache.clear()  # reset DRF throttle counters between tests
        self.admin = make_admin()
        self.passenger = make_passenger()
        self.driver = make_driver()

    def test_admin_login_returns_tokens_role_and_department(self):
        response = login(self.client, "admin", PASSWORD, ADMIN_LOGIN_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        claims = decode_access(response.data["access"])
        self.assertEqual(claims["role"], "admin")
        self.assertEqual(claims["department"], "TODA")
        self.assertEqual(claims["username"], "admin")

    def test_wrong_password_returns_401(self):
        response = login(self.client, "admin", "nope", ADMIN_LOGIN_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_passenger_cannot_login_via_admin_endpoint(self):
        # Fails until the admin serializer rejects non-admins (see notes)
        response = login(self.client, "passenger", PASSWORD, ADMIN_LOGIN_URL)
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        self.assertNotIn("access", response.data)

    def test_driver_cannot_login_via_admin_endpoint(self):
        # Fails until the admin serializer rejects non-admins (see notes)
        response = login(self.client, "driver", PASSWORD, ADMIN_LOGIN_URL)
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        self.assertNotIn("access", response.data)

    def test_user_without_profile_cannot_login_via_admin_endpoint(self):
        make_user("plain")
        response = login(self.client, "plain", PASSWORD, ADMIN_LOGIN_URL)
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )


class TokenRefreshTests(APITestCase):
    def setUp(self):
        cache.clear()  # reset DRF throttle counters between tests
        make_passenger()

    def test_refresh_returns_new_access_token(self):
        tokens = get_tokens(self.client, "passenger", PASSWORD)
        response = self.client.post(
            reverse(REFRESH_URL), {"refresh": tokens["refresh"]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("access", response.data)
        self.assertEqual(decode_access(response.data["access"])["role"], "passenger")

    def test_invalid_refresh_token_returns_401(self):
        response = self.client.post(
            reverse(REFRESH_URL), {"refresh": "not-a-real-token"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_token_is_not_accepted_as_refresh(self):
        tokens = get_tokens(self.client, "passenger", PASSWORD)
        response = self.client.post(
            reverse(REFRESH_URL), {"refresh": tokens["access"]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_refresh_returns_400(self):
        response = self.client.post(reverse(REFRESH_URL), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TokenUsageTests(APITestCase):
    """Shows how other test files reuse the helpers, and that tokens really authenticate."""

    def setUp(self):
        cache.clear()  # reset DRF throttle counters between tests
        make_admin()
        make_passenger()

    def test_no_token_is_rejected(self):
        response = self.client.get(reverse(ADMIN_ONLY_URL))
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_admin_token_grants_access(self):
        authenticate(self.client, "admin", PASSWORD)
        response = self.client.get(reverse(ADMIN_ONLY_URL))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_passenger_token_is_authenticated_but_not_allowed_on_admin_only_url(self):
        authenticate(self.client, "passenger", PASSWORD)
        response = self.client.get(reverse(ADMIN_ONLY_URL))
        # Passes after the admin-only list fix from earlier
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_garbage_token_returns_401(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not.a.token")
        response = self.client.get(reverse(ADMIN_ONLY_URL))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_helper_clears_credentials(self):
        authenticate(self.client, "admin", PASSWORD)
        logout(self.client)
        response = self.client.get(reverse(ADMIN_ONLY_URL))
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_switching_users_on_same_client(self):
        authenticate(self.client, "admin", PASSWORD)
        self.assertEqual(
            self.client.get(reverse(ADMIN_ONLY_URL)).status_code, status.HTTP_200_OK
        )
        authenticate(self.client, "passenger", PASSWORD)
        self.assertEqual(
            self.client.get(reverse(ADMIN_ONLY_URL)).status_code,
            status.HTTP_403_FORBIDDEN,
        )