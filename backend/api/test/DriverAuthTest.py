from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.gis.geos import Point, Polygon
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

# Adjust these imports to match your project layout
from ..features.user.models import Admin, Driver
from..features.admin.models import Toda, TodaStation, RegisteredToda

# Adjust to your url names
LIST_CREATE_URL = "list_create_driver"
DETAIL_URL = "retrieve_update_delete_driver"


# ---------------------------------------------------------------------------
# Factories for Toda / TodaStation / RegisteredToda (field names taken from
# your models). The tests only call these helpers.
# ---------------------------------------------------------------------------
def make_toda(name="Toda A"):
    return Toda.objects.create(
        name=name,
        area=Polygon(
            ((121.0, 14.5), (121.1, 14.5), (121.1, 14.6), (121.0, 14.6), (121.0, 14.5)),
            srid=4326,
        ),
        base_fare=15,
        color="#FF0000",
        prefix="TA",
    )


def make_station(toda, name="Station 1"):
    return TodaStation.objects.create(
        name=name, toda=toda, location=Point(121.05, 14.55, srid=4326)
    )


def register_vehicle(toda, toda_number, vehicle_plate):
    return RegisteredToda.objects.create(
        toda=toda,
        toda_number=toda_number,  # unique per registration
        vehicle_plate=vehicle_plate,
        driver_name="Registered Driver",
        registration_date=timezone.now(),
    )


def make_admin(username="admin", department="TODA", password="adminpass123!"):
    user = User.objects.create_user(username=username, password=password)
    Admin.objects.create(user=user, department=department)
    return user


def make_driver(
    username,
    toda,
    toda_number,
    vehicle_plate,
    rating=0,
    station=None,
    driver_status="ACTIVE",
    first_name="",
    last_name="",
):
    user = User.objects.create_user(
        username=username,
        password="pass12345!",
        first_name=first_name or username.title(),
        last_name=last_name or "Driver",
    )
    Driver.objects.create(
        user=user,
        status=driver_status,
        address="1 Driver St",
        contact_number="09171234567",
        toda_boundary=toda,
        toda_station=station,
        toda_number=toda_number,
        vehicle_plate=vehicle_plate,
        rating=rating,
    )
    register_vehicle(toda, toda_number, vehicle_plate)
    return user


def results(response):
    """Works whether or not StandardPagination wraps the list."""
    data = response.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


class DriverListCreateViewTests(APITestCase):
    def setUp(self):
        self.url = reverse(LIST_CREATE_URL)
        self.admin = make_admin()

        self.toda_a = make_toda("Toda A")
        self.toda_b = make_toda("Toda B")
        self.station_a = make_station(self.toda_a, "Station A")
        self.station_b = make_station(self.toda_b, "Station B")

        self.alice = make_driver(
            "alice", self.toda_a, "01-001", "ABC-111", rating=4.5,
            station=self.station_a, first_name="Alice", last_name="Smith",
        )
        self.bob = make_driver(
            "bob", self.toda_b, "02-001", "BCD-222", rating=2.0,
            station=self.station_b, first_name="Bob", last_name="Jones",
            driver_status="BLACKLISTED",
        )
        self.passenger = User.objects.create_user("passenger", password="x12345678!")

        # A vehicle that is registered but not yet attached to any driver
        register_vehicle(self.toda_a, "01-100", "NEW-999")

    def valid_payload(self, **overrides):
        payload = {
            "username": "newdriver",
            "first_name": "New",
            "last_name": "Driver",
            "password": "StrongPass123!",
            "driver_profile.address": "45 Sample Ave",
            "driver_profile.contact_number": "09171112222",
            "driver_profile.toda_number": "01-100",
            "driver_profile.vehicle_plate": "NEW-999",
        }
        payload.update(overrides)
        return payload

    # ---------- POST ----------
    @patch("django.core.cache.cache.delete")
    def test_create_driver_anonymous_allowed(self, mock_cache_delete):
        response = self.client.post(self.url, self.valid_payload(), format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertNotIn("password", response.data)
        user = User.objects.get(username="newdriver")
        mock_cache_delete.assert_called_with(f"driver_profile:{user.id}")

    def test_create_sets_boundary_from_registration_and_status_active(self):
        payload = self.valid_payload(**{"driver_profile.status": "BLACKLISTED"})
        response = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        driver = Driver.objects.get(user__username="newdriver")
        self.assertEqual(driver.toda_boundary, self.toda_a)
        self.assertEqual(driver.status, "ACTIVE")  # client cannot choose status

    def test_create_with_toda_station(self):
        payload = self.valid_payload(toda_station_id=self.station_a.id)
        response = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        driver = Driver.objects.get(user__username="newdriver")
        self.assertEqual(driver.toda_station, self.station_a)

    def test_create_with_unknown_toda_station_returns_400(self):
        payload = self.valid_payload(toda_station_id=99999)
        response = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="newdriver").exists())

    def test_create_unregistered_toda_returns_400(self):
        payload = self.valid_payload(**{"driver_profile.toda_number": "09-999"})
        response = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="newdriver").exists())

    def test_create_plate_already_used_returns_400(self):
        # ABC-111 is registered AND already attached to alice
        payload = self.valid_payload(
            **{
                "driver_profile.toda_number": "01-001",
                "driver_profile.vehicle_plate": "ABC-111",
            }
        )
        response = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="newdriver").exists())

    def test_create_mismatched_number_and_plate_returns_400(self):
        # valid number from one registration, plate from another
        payload = self.valid_payload(**{"driver_profile.toda_number": "02-001"})
        response = self.client.post(self.url, payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

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

    def test_create_duplicate_username_returns_400(self):
        response = self.client.post(
            self.url, self.valid_payload(username="alice"), format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_failed_create_does_not_leave_orphan_user(self):
        payload = self.valid_payload(**{"driver_profile.toda_number": "09-999"})
        self.client.post(self.url, payload, format="multipart")
        self.assertFalse(User.objects.filter(username="newdriver").exists())

    # ---------- GET ----------
    def test_list_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_list_as_admin_excludes_non_drivers(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {u["username"] for u in results(response)}, {"alice", "bob"}
        )

    def test_list_is_ordered_by_id(self):
        self.client.force_authenticate(self.admin)
        ids = [u["id"] for u in results(self.client.get(self.url))]
        self.assertEqual(ids, sorted(ids))

    def test_non_admin_cannot_list_drivers(self):
        # Fails until the list endpoint has a has_permission check
        # (object-level permissions are never run for list views).
        self.client.force_authenticate(self.passenger)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_driver_cannot_list_drivers(self):
        self.client.force_authenticate(self.alice)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_can_still_post_but_not_get(self):
        # Guards against the admin-only change accidentally closing signup
        response = self.client.post(self.url, self.valid_payload(), format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn(
            self.client.get(self.url).status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_list_search_filter(self):
        self.client.force_authenticate(self.admin)
        for term, expected in [("ali", {"alice"}), ("Jones", {"bob"}), ("bob", {"bob"})]:
            response = self.client.get(self.url, {"search": term})
            self.assertEqual({u["username"] for u in results(response)}, expected)

    def test_list_search_no_match(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"search": "zzz"})
        self.assertEqual(results(response), [])

    def test_list_filter_by_toda_boundary(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"toda_boundary": self.toda_a.id})
        self.assertEqual({u["username"] for u in results(response)}, {"alice"})

    def test_list_filter_by_toda_station(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"toda_station": self.station_b.id})
        self.assertEqual({u["username"] for u in results(response)}, {"bob"})

    def test_list_filter_blacklisted_true(self):
        self.client.force_authenticate(self.admin)
        for value in ("true", "TRUE"):
            response = self.client.get(self.url, {"blacklisted": value})
            self.assertEqual({u["username"] for u in results(response)}, {"bob"})

    def test_list_filter_blacklisted_false_returns_all(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"blacklisted": "false"})
        self.assertEqual(
            {u["username"] for u in results(response)}, {"alice", "bob"}
        )

    def test_list_min_rating_filter(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"min_rating": "3"})
        self.assertEqual({u["username"] for u in results(response)}, {"alice"})

    def test_list_max_rating_filter(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"max_rating": "3"})
        self.assertEqual({u["username"] for u in results(response)}, {"bob"})

    def test_list_combined_filters(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            self.url, {"toda_boundary": self.toda_a.id, "min_rating": "4", "search": "ali"}
        )
        self.assertEqual({u["username"] for u in results(response)}, {"alice"})

    def test_list_invalid_min_rating_returns_400(self):
        # Fails until ValidationError is imported in the view
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"min_rating": "abc"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("min_rating", response.data)

    def test_list_invalid_max_rating_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, {"max_rating": "abc"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("max_rating", response.data)


class DriverRetrieveUpdateDestroyViewTests(APITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.toda_a = make_toda("Toda A")
        self.station_a = make_station(self.toda_a, "Station A")
        self.station_a2 = make_station(self.toda_a, "Station A2")

        self.alice = make_driver(
            "alice", self.toda_a, "01-001", "ABC-111",
            station=self.station_a, first_name="Alice",
        )
        self.bob = make_driver(
            "bob", self.toda_a, "01-002", "BCD-222", first_name="Bob"
        )
        self.alice_url = reverse(DETAIL_URL, kwargs={"pk": self.alice.pk})

    # ---------- permissions / retrieve ----------
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

    def test_other_driver_cannot_retrieve(self):
        self.client.force_authenticate(self.bob)
        response = self.client.get(self.alice_url)
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_passenger_cannot_retrieve_driver(self):
        passenger = User.objects.create_user("passenger", password="x12345678!")
        self.client.force_authenticate(passenger)
        response = self.client.get(self.alice_url)
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_retrieve_nonexistent_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse(DETAIL_URL, kwargs={"pk": 99999}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ---------- update ----------
    def test_owner_can_partial_update_user_fields(self):
        self.client.force_authenticate(self.alice)
        response = self.client.patch(self.alice_url, {"first_name": "Alicia"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.alice.refresh_from_db()
        self.assertEqual(self.alice.first_name, "Alicia")

    def test_owner_can_update_profile_address(self):
        self.client.force_authenticate(self.alice)
        response = self.client.patch(
            self.alice_url, {"driver_profile.address": "99 New Rd"}, format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.alice.driver_profile.refresh_from_db()
        self.assertEqual(self.alice.driver_profile.address, "99 New Rd")

    def test_owner_can_change_toda_station(self):
        self.client.force_authenticate(self.alice)
        response = self.client.patch(
            self.alice_url,
            {"driver_profile.address": "1 Driver St", "toda_station_id": self.station_a2.id},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.alice.driver_profile.refresh_from_db()
        self.assertEqual(self.alice.driver_profile.toda_station, self.station_a2)

    def test_update_with_unknown_toda_station_returns_400(self):
        self.client.force_authenticate(self.alice)
        response = self.client.patch(
            self.alice_url,
            {"driver_profile.address": "1 Driver St", "toda_station_id": 99999},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_to_unregistered_plate_returns_400(self):
        self.client.force_authenticate(self.alice)
        response = self.client.patch(
            self.alice_url, {"driver_profile.vehicle_plate": "ZZZ-000"}, format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.alice.driver_profile.refresh_from_db()
        self.assertEqual(self.alice.driver_profile.vehicle_plate, "ABC-111")

    def test_update_to_plate_owned_by_another_driver_returns_400(self):
        self.client.force_authenticate(self.alice)
        response = self.client.patch(
            self.alice_url,
            {
                "driver_profile.toda_number": "01-002",
                "driver_profile.vehicle_plate": "BCD-222",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_to_new_registered_plate_succeeds(self):
        register_vehicle(self.toda_a, "01-003", "NEW-333")
        self.client.force_authenticate(self.alice)
        response = self.client.patch(
            self.alice_url,
            {
                "driver_profile.toda_number": "01-003",
                "driver_profile.vehicle_plate": "NEW-333",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.alice.driver_profile.refresh_from_db()
        self.assertEqual(self.alice.driver_profile.vehicle_plate, "NEW-333")

    def test_resubmitting_own_plate_is_allowed(self):
        self.client.force_authenticate(self.alice)
        response = self.client.patch(
            self.alice_url,
            {
                "driver_profile.toda_number": "01-001",
                "driver_profile.vehicle_plate": "ABC-111",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_other_driver_cannot_update(self):
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
            self.alice_url, {"driver_profile.status": "BLACKLISTED"}, format="multipart"
        )
        self.alice.driver_profile.refresh_from_db()
        self.assertEqual(self.alice.driver_profile.status, "ACTIVE")

    def test_admin_can_change_status(self):
        # Depends on ProfileUpdateMixin; adjust the payload if it expects a different shape
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            self.alice_url, {"driver_profile.status": "BLACKLISTED"}, format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.alice.driver_profile.refresh_from_db()
        self.assertEqual(self.alice.driver_profile.status, "BLACKLISTED")

    # ---------- delete ----------
    def test_owner_cannot_delete_own_account(self):
        # Your permission class makes DELETE admin-only for drivers
        self.client.force_authenticate(self.alice)
        response = self.client.delete(self.alice_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=self.alice.pk).exists())

    def test_admin_can_delete_driver(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(self.alice_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.alice.pk).exists())

    def test_other_driver_cannot_delete(self):
        self.client.force_authenticate(self.bob)
        response = self.client.delete(self.alice_url)
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )
        self.assertTrue(User.objects.filter(pk=self.alice.pk).exists())