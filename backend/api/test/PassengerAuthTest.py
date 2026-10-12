from unittest.mock import patch

from django.contrib.auth.models import User
from django.template import response
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

# Adjust these imports to match your project layout
from ..features.user.models import Admin, Passenger

# Adjust to your url names
LIST_CREATE_URL = "list_create_passenger"
DETAIL_URL = "retrieve_update_delete_passenger"


def make_passenger(username, rating=0, first_name="", last_name="", password="pass12345!"):
    user = User.objects.create_user(
        username=username,
        password=password,
        first_name=first_name or username.title(),
        last_name=last_name or "Tester",
    )
    Passenger.objects.create(
        user=user,
        address="123 Main St",
        contact_number="09171234567",
        emergency_contact_name="Jane Contact",
        emergency_contact_number="09179876543",
        rating=rating,
    )
    return user


def results(response):
    """Works whether or not StandardPagination wraps the list."""
    data = response.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


class PassengerListCreateViewTests(APITestCase):
    def setUp(self):
        self.url = reverse(LIST_CREATE_URL)
        self.admin = User.objects.create_user("admin", password="adminpass123!")
        Admin.objects.create(user=self.admin, department="TODA")
        self.alice = make_passenger("alice", rating=4.5, first_name="Alice", last_name="Smith")
        self.bob = make_passenger("bob", rating=2.0, first_name="Bob", last_name="Jones")
        self.non_passenger = User.objects.create_user("nopassenger", password="x12345678!")

    def valid_payload(self, **overrides):
        payload = {
            "username": "newuser",
            "first_name": "New",
            "last_name": "User",
            "password": "StrongPass123!",
            "passenger_profile.address": "45 Sample Ave",
            "passenger_profile.contact_number": "09171112222",
            "passenger_profile.emergency_contact_name": "Mary Contact",
            "passenger_profile.emergency_contact_number": "09173334444",
        }
        payload.update(overrides)
        return payload

    # ---------- POST ----------
    @patch("django.core.cache.cache.delete")
    def test_create_passenger_anonymous_allowed(self, mock_cache_delete):
        response = self.client.post(self.url, self.valid_payload(), format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertNotIn("password", response.data)
        user = User.objects.get(username="newuser")
        self.assertTrue(Passenger.objects.filter(user=user).exists())
        mock_cache_delete.assert_called_with(f"passenger_profile:{user.id}")

    def test_create_missing_profile_returns_400(self):
        payload = {
            "username": "noprofile",
            "first_name": "No",
            "last_name": "Profile",
            "password": "StrongPass123!",
        }
        response = self.client.post(self.url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="noprofile").exists())

    def test_create_emergency_contact_cannot_be_self(self):
        payload = self.valid_payload(
            **{"passenger_profile.emergency_contact_name": "New"}  # == first_name
        )
        response = self.client.post(self.url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="newuser").exists())

    def test_create_duplicate_username_returns_400(self):
        response = self.client.post(
            self.url, self.valid_payload(username="alice"), format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ---------- GET ----------
    def test_list_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_list_as_admin_excludes_non_passengers(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = {u["username"] for u in results(response)}
        self.assertEqual(usernames, {"alice", "bob"})

    def test_list_search_filter(self):
        self.client.force_authenticate(self.admin)
        for term, expected in [("ali", {"alice"}), ("Jones", {"bob"}), ("bob", {"bob"})]:
            response = self.client.get(self.url, {"search": term})
            self.assertEqual({u["username"] for u in results(response)}, expected)

    def test_list_search_no_match(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"search": "zzz"})
        self.assertEqual(results(response), [])

    def test_list_min_rating_filter(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"min_rating": "3"})
        self.assertEqual({u["username"] for u in results(response)}, {"alice"})

    def test_list_max_rating_filter(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"max_rating": "3"})
        self.assertEqual({u["username"] for u in results(response)}, {"bob"})

    def test_list_rating_range_filter(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"min_rating": "2", "max_rating": "5"})
        self.assertEqual({u["username"] for u in results(response)}, {"alice", "bob"})

    def test_list_invalid_min_rating_returns_400(self):
        # NOTE: fails until `ValidationError` is imported in the view (see notes)
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"min_rating": "abc"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("min_rating", response.data)

    def test_list_invalid_max_rating_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"max_rating": "abc"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("max_rating", response.data)


class PassengerRetrieveUpdateDestroyViewTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("admin", "a@a.com", "adminpass123!")
        Admin.objects.create(user=self.admin, department="TODA")
        self.alice = make_passenger("alice", first_name="Alice")
        self.bob = make_passenger("bob", first_name="Bob")
        self.alice_url = reverse(DETAIL_URL, kwargs={"pk": self.alice.pk})

    def test_unauthenticated_cannot_retrieve(self):
        response = self.client.get(self.alice_url)
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_owner_can_retrieve(self):
        self.client.force_authenticate(self.alice)
        response = self.client.get(self.alice_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "alice")
        self.assertNotIn("password", response.data)

    def test_admin_can_retrieve(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.alice_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_other_passenger_cannot_retrieve(self):
        self.client.force_authenticate(self.bob)
        response = self.client.get(self.alice_url)
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_owner_can_partial_update(self):
        self.client.force_authenticate(self.alice)
        response = self.client.patch(self.alice_url, {"first_name": "Alicia"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.alice.refresh_from_db()
        self.assertEqual(self.alice.first_name, "Alicia")

    def test_other_passenger_cannot_update(self):
        self.client.force_authenticate(self.bob)
        response = self.client.patch(self.alice_url, {"first_name": "Hacked"}, format="json")
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )
        self.alice.refresh_from_db()
        self.assertEqual(self.alice.first_name, "Alice")

    def test_non_admin_cannot_change_status(self):
        self.client.force_authenticate(self.alice)
        self.client.patch(
            self.alice_url, {"passenger_profile.status": "banned"}, format="multipart"
        )
        self.alice.passenger_profile.refresh_from_db()
        self.assertNotEqual(self.alice.passenger_profile.status, "banned")

    def test_owner_can_delete(self):
        self.client.force_authenticate(self.alice)
        response = self.client.delete(self.alice_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.alice.pk).exists())

    def test_other_passenger_cannot_delete(self):
        self.client.force_authenticate(self.bob)
        response = self.client.delete(self.alice_url)
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )
        self.assertTrue(User.objects.filter(pk=self.alice.pk).exists())

    def test_retrieve_nonexistent_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse(DETAIL_URL, kwargs={"pk": 99999}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)