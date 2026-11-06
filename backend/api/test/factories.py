"""
Shared model factories for the booking / chat / report / notification tests.

Geography used everywhere:
    TODA area  : lng 121.00–121.10, lat 14.50–14.60
    PICKUP     : (14.55, 121.05)   – inside the TODA, on the station
    DROPOFF    : (14.56, 121.06)
    FAR_AWAY   : (14.70, 121.30)   – outside every TODA
"""
import itertools
import uuid

from django.contrib.auth.models import User
from django.contrib.gis.geos import Point, Polygon

from api.features.admin.models import Toda, TodaStation
from api.features.booking.models import Booking, DriverQueue
from api.features.user.models import Admin, Driver, Passenger

PASSWORD = "Str0ng-Passw0rd!x"

PICKUP = {"lat": 14.55, "lng": 121.05}
DROPOFF = {"lat": 14.56, "lng": 121.06}
FAR_AWAY = {"lat": 14.70, "lng": 121.30}

_seq = itertools.count(1)
_driver_numbers = itertools.count(1)


def next_driver_number():
    """A mobile number no other test driver has: Driver.contact_number is unique ("09180000001", ...)."""
    return f"0918{next(_driver_numbers):07d}"


def idem():
    """Idempotency-Key header for IdempotentAPIView endpoints."""
    return {"HTTP_IDEMPOTENCY_KEY": str(uuid.uuid4())}


def point(coords):
    return Point(coords["lng"], coords["lat"], srid=4326)


def offset(coords, metres_north):
    """Same longitude, `metres_north` metres further north (≈111 km per degree)."""
    return {"lat": coords["lat"] + metres_north / 111_000, "lng": coords["lng"]}


def make_toda(name="Toda A", prefix="01"):
    return Toda.objects.create(
        name=name,
        area=Polygon(
            ((121.0, 14.5), (121.1, 14.5), (121.1, 14.6), (121.0, 14.6), (121.0, 14.5)),
            srid=4326,
        ),
        base_fare=15,
        color="#FF0000",
        prefix=prefix,
    )


def make_station(toda, name="Station 1"):
    return TodaStation.objects.create(name=name, toda=toda, location=point(PICKUP))


def make_user(prefix="user"):
    n = next(_seq)
    return User.objects.create_user(f"{prefix}{n}", f"{prefix}{n}@example.com", PASSWORD)


def make_passenger(**extra):
    user = make_user("passenger")
    return Passenger.objects.create(
        user=user,
        address="Somewhere St.",
        contact_number="09170000000",
        emergency_contact_name="Mom",
        emergency_contact_number="09170000001",
        verified=True,
        **extra,
    )


def make_driver(toda=None, station=None, **extra):
    n = next(_seq)
    user = make_user("driver")
    fields = dict(
        user=user,
        address="Driver St.",
        contact_number=next_driver_number(),
        toda_boundary=toda,
        toda_station=station,
        toda_number=f"01-{n:03d}",
        vehicle_plate=f"PLT{n:04d}",
        verified=True,
        status="ACTIVE",
    )
    fields.update(extra)
    return Driver.objects.create(**fields)


def make_admin(department="TODA"):
    user = make_user(f"admin_{department.lower()}")
    Admin.objects.create(user=user, department=department)
    return user


def make_booking(passenger, driver=None, status=Booking.Status.ACCEPTED, start=PICKUP, end=DROPOFF):
    return Booking.objects.create(
        passenger=passenger,
        driver=driver,
        start=point(start),
        start_address="Pickup address",
        end=point(end),
        end_address="Dropoff address",
        price=20,
        status=status,
    )


def queue_driver(driver, coords=PICKUP):
    return DriverQueue.objects.create(driver=driver, location=point(coords))
