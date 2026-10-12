"""
Reusable login helpers for any API test.

    from .auth_helpers import authenticate, get_tokens, USER_LOGIN_URL

    class MyTests(APITestCase):
        def test_something(self):
            authenticate(self.client, "alice", "pass12345!")
            response = self.client.get(...)          # sent with Bearer token

    access = get_access_token(self.client, "admin", "pw", ADMIN_LOGIN_URL)
"""
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken

# URL names from your urls.py
USER_LOGIN_URL = "token_obtain_pair"          # /token/user
ADMIN_LOGIN_URL = "token_obtain_pair_admin"   # /token/admin
REFRESH_URL = "token_refresh"                 # /token/refresh/


def login(client, username, password, url_name=USER_LOGIN_URL):
    """POST credentials and return the raw response (use this to test failures)."""
    return client.post(
        reverse(url_name),
        {"username": username, "password": password},
        format="json",
    )


def get_tokens(client, username, password, url_name=USER_LOGIN_URL):
    """Log in, assert success, and return {'access': ..., 'refresh': ...}."""
    response = login(client, username, password, url_name)
    assert response.status_code == status.HTTP_200_OK, (
        f"Login failed for {username!r} via {url_name}: "
        f"{response.status_code} {getattr(response, 'data', '')}"
    )
    return {"access": response.data["access"], "refresh": response.data["refresh"]}


def get_access_token(client, username, password, url_name=USER_LOGIN_URL):
    return get_tokens(client, username, password, url_name)["access"]


def authenticate(client, username, password, url_name=USER_LOGIN_URL):
    """
    Log in through the real endpoint and set the Bearer header on `client`,
    so every following request is sent as that user. Returns the tokens.
    """
    tokens = get_tokens(client, username, password, url_name)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return tokens


def logout(client):
    """Remove the Authorization header from `client`."""
    client.credentials()


def decode_access(token):
    """Return the claims inside an access token, e.g. decode_access(t)['role']."""
    return AccessToken(token).payload