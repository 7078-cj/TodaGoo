import io
import uuid
from datetime import datetime

import pandas as pd
from django.contrib.auth.models import User
from django.contrib.gis.geos import Point, Polygon
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

# Adjust these imports to match your project layout
from api.features.admin.models import RegisteredToda, Toda, TodaStation
from api.features.user.models import Admin, Driver

# URL names from your urls.py
BOUNDARY_LIST = "toda-boundary-list-create"
BOUNDARY_DETAIL = "toda-boundary-detail"
TODA_LIST = "toda-list"
TODA_DETAIL = "toda-detail"
STATION_LIST = "toda-station-list-create"
STATION_DETAIL = "toda-station-detail"
STATION_PREFIX = "toda-station-prefix"

DENIED = (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# Helpers / factories
# ---------------------------------------------------------------------------
def idem():
    """
    Headers for IdempotentAPIView (station endpoints). I haven't seen that class;
    if it needs a different header name, change it here. If it doesn't need one,
    this is harmless.
    """
    return {"HTTP_IDEMPOTENCY_KEY": str(uuid.uuid4())}


def location(lat, lng):
    """Payload for TodaStationSerializer.location (PointField in booking.serializers)."""
    return {"lat": lat, "lng": lng}


def ring(x0=121.0, y0=14.5, size=0.1, closed=False):
    pts = [[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size]]
    return pts + [pts[0]] if closed else pts


def make_toda(name="Toda A", prefix="01", x0=121.0):
    return Toda.objects.create(
        name=name,
        area=Polygon(
            (
                (x0, 14.5),
                (x0 + 0.1, 14.5),
                (x0 + 0.1, 14.6),
                (x0, 14.6),
                (x0, 14.5),
            ),
            srid=4326,
        ),
        base_fare=15,
        color="#FF0000",
        prefix=prefix,
    )


def make_station(toda, name="Station 1", lng=121.05, lat=14.55):
    return TodaStation.objects.create(
        name=name, toda=toda, location=Point(lng, lat, srid=4326)
    )


def register(toda, toda_number, plate="ABC-111", driver_name="Juan Dela Cruz", when=None):
    return RegisteredToda.objects.create(
        toda=toda,
        toda_number=toda_number,
        vehicle_plate=plate,
        driver_name=driver_name,
        registration_date=when or timezone.now(),
    )


def make_admin(username="admin", department="TODA"):
    user = User.objects.create_user(username=username, password="pass12345!")
    Admin.objects.create(user=user, department=department)
    return user


def results(response):
    data = response.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


def excel_file(rows, columns=None, name="todas.xlsx"):
    columns = columns or [
        "toda_number", "vehicle_plate", "driver_name", "registration_date", "toda_name",
    ]
    buf = io.BytesIO()
    pd.DataFrame(rows, columns=columns).to_excel(buf, index=False)
    return SimpleUploadedFile(
        name,
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


LOCMEM_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@override_settings(CACHES=LOCMEM_CACHE)  # a real in-memory cache, and never touches Redis
class TodaBase(APITestCase):
    def setUp(self):
        cache.clear()  # views cache lists; also resets throttles
        self.admin = make_admin()
        self.mdrrmo = make_admin("mdrrmo", department="MDRRMO")
        self.outsider = User.objects.create_user("outsider", password="pass12345!")
        self.toda_a = make_toda("Toda A", prefix="01", x0=121.0)
        self.toda_b = make_toda("Toda B", prefix="02", x0=122.0)


# ---------------------------------------------------------------------------
# Boundaries
# ---------------------------------------------------------------------------
class BoundaryListCreateTests(TodaBase):
    def setUp(self):
        super().setUp()
        self.url = reverse(BOUNDARY_LIST)

    def payload(self, **overrides):
        data = {
            "name": "New Toda",
            "area": ring(x0=123.0),
            "base_fare": 20,
            "color": "#00FF00",
            "prefix": "03",
        }
        data.update(overrides)
        return data

    # ----- permissions -----
    def test_anonymous_cannot_list(self):
        self.assertIn(self.client.get(self.url).status_code, DENIED)

    def test_non_admin_cannot_list(self):
        # KNOWN BUG: TodaAdminPermission only defines has_object_permission, which DRF
        # never calls on list/create endpoints, so any logged-in user gets through.
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_mdrrmo_admin_cannot_list(self):
        # KNOWN BUG: same missing has_permission. MDRRMO admins are blocked on detail
        # routes but allowed on list routes.
        self.client.force_authenticate(self.mdrrmo)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_non_admin_cannot_create(self):
        # KNOWN BUG: same missing has_permission.
        self.client.force_authenticate(self.outsider)
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Toda.objects.filter(name="New Toda").exists())

    # ----- list + cache -----
    def test_admin_can_list(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({t["name"] for t in response.data}, {"Toda A", "Toda B"})

    def test_list_returns_area_as_coordinates(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url)
        area = response.data[0]["area"]
        self.assertEqual(len(area), 1)        # one outer ring
        self.assertEqual(len(area[0]), 5)     # closed ring: 4 corners + repeat

    def test_list_populates_cache(self):
        self.client.force_authenticate(self.admin)
        self.client.get(self.url)
        self.assertEqual(len(cache.get("toda_boundaries_list")), 2)

    def test_list_is_served_from_cache(self):
        # A sentinel proves the view returns the cached value instead of querying
        # (listing after an ORM insert can't, if you have signals that clear the cache).
        cache.set("toda_boundaries_list", [{"sentinel": True}])
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self.url).data, [{"sentinel": True}])

    def test_create_invalidates_list_cache(self):
        self.client.force_authenticate(self.admin)
        self.client.get(self.url)  # warm the cache
        self.client.post(self.url, self.payload(), format="json")
        names = {t["name"] for t in self.client.get(self.url).data}
        self.assertIn("New Toda", names)

    # ----- create -----
    def test_create_boundary_with_open_ring(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        toda = Toda.objects.get(name="New Toda")
        self.assertEqual(toda.prefix, "03")
        self.assertEqual(len(toda.area.coords[0]), 5)  # closed automatically

    def test_create_boundary_with_already_closed_ring(self):
        self.client.force_authenticate(self.admin)
        payload = self.payload(area=ring(x0=123.0, closed=True))
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(len(Toda.objects.get(name="New Toda").area.coords[0]), 5)

    def test_create_response_uses_read_representation(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.data["name"], "New Toda")
        self.assertEqual(len(response.data["area"][0]), 5)

    def test_create_ring_with_too_few_points_returns_400(self):
        self.client.force_authenticate(self.admin)
        payload = self.payload(area=[[121.0, 14.5], [121.1, 14.5]])
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area", response.data)

    def test_create_area_wrong_type_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload(area="abc"), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_empty_area_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload(area=[]), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_missing_required_fields_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, {"name": "Only a name"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_without_area_returns_400(self):
        # KNOWN BUG: `area` is optional in TodaWriteSerializer but NOT NULL in the model,
        # so this raises IntegrityError (500) instead of returning 400.
        self.client.force_authenticate(self.admin)
        payload = self.payload()
        payload.pop("area")
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class BoundaryDetailTests(TodaBase):
    def setUp(self):
        super().setUp()
        self.url = reverse(BOUNDARY_DETAIL, kwargs={"pk": self.toda_a.pk})
        self.list_url = reverse(BOUNDARY_LIST)

    def test_anonymous_denied(self):
        self.assertIn(self.client.get(self.url).status_code, DENIED)

    def test_non_admin_denied_for_all_methods(self):
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.patch(self.url, {"name": "X"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.client.delete(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Toda.objects.filter(pk=self.toda_a.pk).exists())

    def test_retrieve(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Toda A")
        self.assertEqual(len(response.data["area"][0]), 5)

    def test_retrieve_nonexistent_returns_404(self):
        self.client.force_authenticate(self.admin)
        url = reverse(BOUNDARY_DETAIL, kwargs={"pk": 99999})
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_updates_fields(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            self.url, {"name": "Renamed", "base_fare": 25}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.toda_a.refresh_from_db()
        self.assertEqual(self.toda_a.name, "Renamed")
        self.assertEqual(self.toda_a.base_fare, 25)

    def test_patch_area(self):
        self.client.force_authenticate(self.admin)
        new_ring = ring(x0=125.0, y0=10.0)
        response = self.client.patch(self.url, {"area": new_ring}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.toda_a.refresh_from_db()
        self.assertEqual(self.toda_a.area.coords[0][0], (125.0, 10.0))

    def test_patch_invalid_area_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(self.url, {"area": [[1, 2]]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_invalidates_list_cache(self):
        self.client.force_authenticate(self.admin)
        self.client.get(self.list_url)  # warm the cache
        self.client.patch(self.url, {"name": "Renamed"}, format="json")
        names = {t["name"] for t in self.client.get(self.list_url).data}
        self.assertIn("Renamed", names)
        self.assertNotIn("Toda A", names)

    def test_delete_unused_boundary(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Toda.objects.filter(pk=self.toda_a.pk).exists())

    def test_delete_invalidates_list_cache(self):
        self.client.force_authenticate(self.admin)
        self.client.get(self.list_url)  # warm the cache
        self.client.delete(self.url)
        names = {t["name"] for t in self.client.get(self.list_url).data}
        self.assertEqual(names, {"Toda B"})

    def test_delete_boundary_with_stations_returns_400(self):
        # KNOWN BUG: ProtectedError isn't handled here (only in the registration view),
        # so this is a 500 instead of a friendly 400.
        make_station(self.toda_a)
        self.client.force_authenticate(self.admin)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Toda.objects.filter(pk=self.toda_a.pk).exists())

    def test_delete_boundary_with_registrations_returns_400(self):
        # KNOWN BUG: same unhandled ProtectedError as above.
        register(self.toda_a, "01-001")
        self.client.force_authenticate(self.admin)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Toda.objects.filter(pk=self.toda_a.pk).exists())


# ---------------------------------------------------------------------------
# Registered TODAs: list / filters / single create
# ---------------------------------------------------------------------------
class RegisteredTodaListCreateTests(TodaBase):
    def setUp(self):
        super().setUp()
        self.url = reverse(TODA_LIST)
        self.r1 = register(
            self.toda_a, "01-001", "ABC-111", "Juan Dela Cruz",
            when=timezone.make_aware(datetime(2024, 1, 15, 9, 0)),
        )
        self.r2 = register(
            self.toda_b, "02-002", "XYZ-222", "Maria Santos",
            when=timezone.make_aware(datetime(2024, 2, 20, 9, 0)),
        )

    def payload(self, **overrides):
        data = {
            "toda_number": "01-050",
            "driver_name": "Pedro Penduko",
            "vehicle_plate": "NEW-333",
            "registration_date": "2024-03-01T08:00:00Z",
        }
        data.update(overrides)
        return data

    # ----- permissions -----
    def test_anonymous_denied(self):
        self.assertIn(self.client.get(self.url).status_code, DENIED)

    def test_non_admin_denied(self):
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ----- list + filters -----
    def test_admin_can_list(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {r["toda_number"] for r in results(response)}, {"01-001", "02-002"}
        )

    def test_list_includes_toda_name(self):
        self.client.force_authenticate(self.admin)
        rows = {r["toda_number"]: r for r in results(self.client.get(self.url))}
        self.assertEqual(rows["01-001"]["toda_name"], "Toda A")

    def _numbers(self, **params):
        self.client.force_authenticate(self.admin)
        return {r["toda_number"] for r in results(self.client.get(self.url, params))}

    def test_filter_by_toda_number(self):
        self.assertEqual(self._numbers(toda_number="01-0"), {"01-001"})

    def test_filter_by_driver_name_is_case_insensitive(self):
        self.assertEqual(self._numbers(driver_name="maria"), {"02-002"})

    def test_filter_by_vehicle_plate(self):
        self.assertEqual(self._numbers(vehicle_plate="XYZ"), {"02-002"})

    def test_filter_by_toda_boundary_name(self):
        self.assertEqual(self._numbers(toda_boundary="Toda B"), {"02-002"})

    def test_filter_by_registration_date(self):
        self.assertEqual(self._numbers(registration_date="2024-01-15"), {"01-001"})

    def test_combined_filters(self):
        self.assertEqual(
            self._numbers(toda_boundary="Toda", driver_name="juan"), {"01-001"}
        )

    def test_filter_no_match(self):
        self.assertEqual(self._numbers(driver_name="nobody"), set())

    # ----- single create -----
    def test_create_assigns_toda_from_number_prefix(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        created = RegisteredToda.objects.get(toda_number="01-050")
        self.assertEqual(created.toda, self.toda_a)
        self.assertEqual(response.data["toda_name"], "Toda A")

    def test_create_uses_prefix_for_other_toda(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url, self.payload(toda_number="02-050"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(RegisteredToda.objects.get(toda_number="02-050").toda, self.toda_b)

    def test_client_cannot_choose_toda(self):
        self.client.force_authenticate(self.admin)
        payload = self.payload(toda=self.toda_b.pk)  # number says 01 -> Toda A
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(RegisteredToda.objects.get(toda_number="01-050").toda, self.toda_a)

    def test_create_too_short_number_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload(toda_number="1"), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_missing_number_returns_400(self):
        self.client.force_authenticate(self.admin)
        payload = self.payload()
        payload.pop("toda_number")
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_non_numeric_prefix_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url, self.payload(toda_number="AB-123"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_unknown_prefix_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url, self.payload(toda_number="09-123"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(RegisteredToda.objects.filter(toda_number="09-123").exists())

    def test_create_duplicate_number_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url, self.payload(toda_number="01-001"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_missing_driver_name_returns_400(self):
        self.client.force_authenticate(self.admin)
        payload = self.payload()
        payload.pop("driver_name")
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_non_string_number_returns_400(self):
        # KNOWN BUG: `.strip()` is called on whatever was sent, so a JSON number
        # raises AttributeError (500) instead of 400.
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload(toda_number=123456), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Registered TODAs: Excel bulk upload
# ---------------------------------------------------------------------------
class RegisteredTodaExcelUploadTests(TodaBase):
    def setUp(self):
        super().setUp()
        self.url = reverse(TODA_LIST)
        self.client.force_authenticate(self.admin)

    def rows(self):
        return [
            ["01-101", "AAA-001", "Driver One", datetime(2024, 1, 10, 8, 0), "Toda A"],
            ["01-102", "AAA-002", "Driver Two", datetime(2024, 1, 11, 8, 0), "Toda A"],
            ["02-101", "BBB-001", "Driver Three", datetime(2024, 1, 12, 8, 0), "Toda B"],
        ]

    def upload(self, file):
        return self.client.post(self.url, {"file": file}, format="multipart")

    def test_non_admin_cannot_upload(self):
        self.client.force_authenticate(self.outsider)
        response = self.upload(excel_file(self.rows()))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(RegisteredToda.objects.count(), 0)

    def test_valid_upload_creates_records(self):
        response = self.upload(excel_file(self.rows()))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(RegisteredToda.objects.count(), 3)
        self.assertIn("3", response.data["message"])

    def test_upload_assigns_toda_by_prefix(self):
        self.upload(excel_file(self.rows()))
        self.assertEqual(RegisteredToda.objects.get(toda_number="01-101").toda, self.toda_a)
        self.assertEqual(RegisteredToda.objects.get(toda_number="02-101").toda, self.toda_b)

    def test_upload_stores_row_values(self):
        self.upload(excel_file(self.rows()))
        record = RegisteredToda.objects.get(toda_number="01-102")
        self.assertEqual(record.vehicle_plate, "AAA-002")
        self.assertEqual(record.driver_name, "Driver Two")

    def test_upload_missing_columns_returns_400(self):
        file = excel_file(
            [["01-101", "AAA-001"]], columns=["toda_number", "vehicle_plate"]
        )
        response = self.upload(file)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Missing columns", response.data["error"])
        self.assertEqual(RegisteredToda.objects.count(), 0)

    def test_upload_with_unknown_prefix_returns_400(self):
        # KNOWN BUG: rows with an unknown prefix get toda=None and bulk_create raises
        # IntegrityError (500). Nothing is saved (atomic), but the client should get a 400.
        rows = self.rows() + [
            ["09-101", "CCC-001", "Driver Four", datetime(2024, 1, 13, 8, 0), "Nowhere"]
        ]
        response = self.upload(excel_file(rows))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(RegisteredToda.objects.count(), 0)

    def test_upload_with_duplicate_numbers_returns_400(self):
        # KNOWN BUG: a toda_number that already exists (or repeats in the file) raises
        # IntegrityError (500) instead of a 400 that names the duplicates.
        register(self.toda_a, "01-101")
        response = self.upload(excel_file(self.rows()))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(RegisteredToda.objects.count(), 1)


# ---------------------------------------------------------------------------
# Registered TODAs: detail
# ---------------------------------------------------------------------------
class RegisteredTodaDetailTests(TodaBase):
    def setUp(self):
        super().setUp()
        self.record = register(self.toda_a, "01-001", "ABC-111", "Juan Dela Cruz")
        self.url = reverse(TODA_DETAIL, kwargs={"pk": self.record.pk})

    def put_payload(self, **overrides):
        data = {
            "toda_number": "01-001",
            "driver_name": "Juan Updated",
            "vehicle_plate": "ABC-111",
            "registration_date": "2024-01-15T09:00:00Z",
        }
        data.update(overrides)
        return data

    def test_anonymous_denied(self):
        self.assertIn(self.client.get(self.url).status_code, DENIED)

    def test_non_admin_denied(self):
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.delete(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(RegisteredToda.objects.filter(pk=self.record.pk).exists())

    def test_retrieve(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["toda_number"], "01-001")

    def test_retrieve_nonexistent_returns_404(self):
        self.client.force_authenticate(self.admin)
        url = reverse(TODA_DETAIL, kwargs={"pk": 99999})
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_put_updates_record(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put(self.url, self.put_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.record.refresh_from_db()
        self.assertEqual(self.record.driver_name, "Juan Updated")

    def test_put_changing_prefix_reassigns_toda(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            self.url, self.put_payload(toda_number="02-001"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.record.refresh_from_db()
        self.assertEqual(self.record.toda, self.toda_b)

    def test_put_unknown_prefix_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            self.url, self.put_payload(toda_number="09-001"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.record.refresh_from_db()
        self.assertEqual(self.record.toda_number, "01-001")

    def test_put_too_short_number_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            self.url, self.put_payload(toda_number="1"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_put_duplicate_number_returns_400(self):
        register(self.toda_a, "01-002", "DUP-222")
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            self.url, self.put_payload(toda_number="01-002"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_only_driver_name(self):
        # KNOWN BUG: update() demands toda_number even on PATCH, so a partial update
        # that doesn't resend it gets "Invalid TODA number." (400).
        self.client.force_authenticate(self.admin)
        response = self.client.patch(self.url, {"driver_name": "Only Name"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.record.refresh_from_db()
        self.assertEqual(self.record.driver_name, "Only Name")

    def test_delete(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(RegisteredToda.objects.filter(pk=self.record.pk).exists())

    def test_delete_nonexistent_returns_404(self):
        self.client.force_authenticate(self.admin)
        url = reverse(TODA_DETAIL, kwargs={"pk": 99999})
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Stations
# ---------------------------------------------------------------------------
class StationListCreateTests(TodaBase):
    def setUp(self):
        super().setUp()
        self.url = reverse(STATION_LIST)
        self.station_a = make_station(self.toda_a, "Station A", lng=121.05, lat=14.55)
        self.station_b = make_station(self.toda_b, "Station B", lng=122.05, lat=14.55)

    def payload(self, name="New Station", lat=14.52, lng=121.02):
        return {"name": name, "location": location(lat, lng)}

    # ----- list (public) + cache -----
    def test_anonymous_can_list(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({s["name"] for s in response.data}, {"Station A", "Station B"})

    def test_filter_by_toda_id(self):
        response = self.client.get(self.url, {"toda_id": self.toda_b.pk})
        self.assertEqual({s["name"] for s in response.data}, {"Station B"})

    def test_filtered_and_unfiltered_lists_are_cached_separately(self):
        self.assertEqual(len(self.client.get(self.url).data), 2)
        self.assertEqual(len(self.client.get(self.url, {"toda_id": self.toda_a.pk}).data), 1)

    def test_list_populates_cache(self):
        self.client.get(self.url)
        self.assertEqual(len(cache.get("toda_stations_list:all")), 2)

    def test_list_is_served_from_cache(self):
        cache.set("toda_stations_list:all", [{"sentinel": True}])
        self.assertEqual(self.client.get(self.url).data, [{"sentinel": True}])

    # ----- create -----
    def test_anonymous_cannot_create(self):
        response = self.client.post(self.url, self.payload(), format="json", **idem())
        self.assertIn(response.status_code, DENIED)

    def test_admin_can_create_inside_a_toda(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload(), format="json", **idem())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        station = TodaStation.objects.get(name="New Station")
        self.assertEqual(station.toda, self.toda_a)  # derived from the location

    def test_create_picks_toda_from_location(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url, self.payload("In B", lat=14.52, lng=122.02), format="json", **idem()
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(TodaStation.objects.get(name="In B").toda, self.toda_b)

    def test_client_cannot_choose_toda(self):
        self.client.force_authenticate(self.admin)
        payload = self.payload()
        payload["toda"] = self.toda_b.pk
        response = self.client.post(self.url, payload, format="json", **idem())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(TodaStation.objects.get(name="New Station").toda, self.toda_a)

    def test_create_outside_all_todas_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url, self.payload(lat=0.0, lng=0.0), format="json", **idem()
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location", response.data)
        self.assertFalse(TodaStation.objects.filter(name="New Station").exists())

    def test_create_missing_name_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url, {"location": location(14.52, 121.02)}, format="json", **idem()
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_missing_location_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, {"name": "No place"}, format="json", **idem())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_location_must_be_an_object(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url, {"name": "Bad", "location": "14.52,121.02"}, format="json", **idem()
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location", response.data)

    def test_create_location_missing_lng_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url, {"name": "Bad", "location": {"lat": 14.52}}, format="json", **idem()
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location", response.data)

    def test_create_location_non_numeric_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url,
            {"name": "Bad", "location": {"lat": "north", "lng": "east"}},
            format="json",
            **idem(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("location", response.data)

    def test_create_location_accepts_numeric_strings(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            self.url,
            {"name": "Strings", "location": {"lat": "14.52", "lng": "121.02"}},
            format="json",
            **idem(),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_create_response_location_uses_lat_lng(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.url, self.payload(), format="json", **idem())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["location"], {"lat": 14.52, "lng": 121.02})

    def test_non_admin_cannot_create_station(self):
        # KNOWN BUG: POST only requires IsAuthenticated, so any logged-in user
        # (passenger, driver) can create stations.
        self.client.force_authenticate(self.outsider)
        response = self.client.post(self.url, self.payload(), format="json", **idem())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(TodaStation.objects.filter(name="New Station").exists())

    def test_create_shows_up_in_list_after_cache_was_warm(self):
        # KNOWN BUG: creating a station never clears `toda_stations_list:*`
        # or `toda_stations_prefix:*`, so lists stay stale for up to 15 minutes.
        self.client.get(self.url)  # warm
        self.client.force_authenticate(self.admin)
        self.client.post(self.url, self.payload(), format="json", **idem())
        names = {s["name"] for s in self.client.get(self.url).data}
        self.assertIn("New Station", names)


class StationDetailTests(TodaBase):
    def setUp(self):
        super().setUp()
        self.station = make_station(self.toda_a, "Station A", lng=121.05, lat=14.55)
        self.url = reverse(STATION_DETAIL, kwargs={"pk": self.station.pk})

    def test_anonymous_denied(self):
        self.assertIn(self.client.get(self.url).status_code, DENIED)

    def test_retrieve(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url, **idem())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Station A")
        self.assertEqual(response.data["location"], {"lat": 14.55, "lng": 121.05})

    def test_retrieve_nonexistent_returns_404(self):
        self.client.force_authenticate(self.admin)
        url = reverse(STATION_DETAIL, kwargs={"pk": 99999})
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_name(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(self.url, {"name": "Renamed"}, format="json", **idem())
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.station.refresh_from_db()
        self.assertEqual(self.station.name, "Renamed")

    def test_moving_station_into_another_toda_updates_toda(self):
        # KNOWN BUG: the serializer only derives `toda` in create(); on update the
        # location changes but the station stays attached to the old TODA.
        self.client.force_authenticate(self.admin)
        make_toda("Toda C", prefix="03", x0=123.0)
        response = self.client.patch(
            self.url, {"location": location(14.55, 122.05)}, format="json", **idem()
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.station.refresh_from_db()
        self.assertEqual(self.station.toda, self.toda_b)

    def test_delete_station(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(self.url, **idem())
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TodaStation.objects.filter(pk=self.station.pk).exists())

    def test_non_admin_cannot_modify_or_delete(self):
        # KNOWN BUG: permission_classes = [IsAuthenticated], so any logged-in user can.
        self.client.force_authenticate(self.outsider)
        self.assertEqual(
            self.client.patch(self.url, {"name": "Hacked"}, format="json", **idem()).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.delete(self.url, **idem()).status_code, status.HTTP_403_FORBIDDEN
        )
        self.assertTrue(TodaStation.objects.filter(pk=self.station.pk).exists())

    def test_delete_station_assigned_to_driver_returns_400(self):
        # KNOWN BUG: Driver.toda_station is PROTECT and ProtectedError isn't handled
        # here, so this is a 500 instead of a friendly 400.
        driver_user = User.objects.create_user("driver1", password="pass12345!")
        Driver.objects.create(
            user=driver_user,
            address="1 Driver St",
            contact_number="09171234567",
            toda_number="01-001",
            vehicle_plate="DRV-001",
            toda_boundary=self.toda_a,
            toda_station=self.station,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.delete(self.url, **idem())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(TodaStation.objects.filter(pk=self.station.pk).exists())


class StationByPrefixTests(TodaBase):
    def setUp(self):
        super().setUp()
        self.url = reverse(STATION_PREFIX)
        make_station(self.toda_a, "Station A1", lng=121.02, lat=14.52)
        make_station(self.toda_a, "Station A2", lng=121.05, lat=14.55)
        make_station(self.toda_b, "Station B1", lng=122.05, lat=14.55)
        self.client.force_authenticate(self.outsider)  # any logged-in user, e.g. a passenger

    def test_returns_stations_for_prefix(self):
        response = self.client.get(self.url, {"prefix": "01"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({s["name"] for s in response.data}, {"Station A1", "Station A2"})

    def test_other_prefix_returns_other_stations(self):
        response = self.client.get(self.url, {"prefix": "02"})
        self.assertEqual({s["name"] for s in response.data}, {"Station B1"})

    def test_missing_prefix_returns_400(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("prefix", response.data["error"])

    def test_unknown_prefix_returns_400(self):
        response = self.client.get(self.url, {"prefix": "99"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_toda_without_stations_returns_empty_list(self):
        make_toda("Empty", prefix="05", x0=125.0)
        response = self.client.get(self.url, {"prefix": "05"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(list(response.data), [])

    def test_result_is_cached(self):
        self.client.get(self.url, {"prefix": "01"})
        self.assertEqual(len(cache.get("toda_stations_prefix:01")), 2)

    def test_cached_result_is_served(self):
        cache.set("toda_stations_prefix:01", [{"sentinel": True}])
        response = self.client.get(self.url, {"prefix": "01"})
        self.assertEqual(response.data, [{"sentinel": True}])

    def test_unknown_prefix_is_not_cached_as_an_error(self):
        self.client.get(self.url, {"prefix": "07"})
        make_toda("Late", prefix="07", x0=127.0)
        response = self.client.get(self.url, {"prefix": "07"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)