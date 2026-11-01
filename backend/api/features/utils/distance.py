from django.contrib.gis.geos import Point
from math import radians, sin, cos, sqrt, atan2
from ..admin.models import Toda, BookingSettings
from datetime import time
from zoneinfo import ZoneInfo

from django.utils import timezone
  

PH_TZ = ZoneInfo("Asia/Manila")

RATE_PER_KM = 10      # pesos per km

def get_ph_time() -> time:
    """Returns the current time of day in Philippine time."""
    return timezone.now().astimezone(PH_TZ).time()


def is_within_night_window(current: time, start: time, end: time) -> bool:
    """
    Checks whether `current` falls inside the night fare window.
    Handles windows that cross midnight (e.g. 22:00 -> 05:00).
    """
    if start <= end:
        return start <= current < end

    return current >= start or current < end


def get_night_fare_multiplier() -> float:
    settings_obj = BookingSettings.objects.first()

    if settings_obj is None or not settings_obj.is_night_fare_enabled:
        return 1.0

    if is_within_night_window(
        get_ph_time(),
        settings_obj.night_fare_start_time,
        settings_obj.night_fare_multiplier_end_time,
    ):
        return float(settings_obj.night_fare_multiplier)

    return 1.0


def haversine_distance(p1: Point, p2: Point):
    """
    Returns the distance between two Point objects in kilometers.
    Uses the Haversine formula for accurate great-circle distance.
    """
    R = 6371.0  # Earth radius in km

    lat1 = radians(p1.y)
    lon1 = radians(p1.x)
    lat2 = radians(p2.y)
    lon2 = radians(p2.x)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return R * c

MAX_STATION_DISTANCE_M = 50          # how far outside a zone is still accepted
METERS_PER_DEGREE = 111_000          # close enough for a 50 m tolerance


def find_station(point: Point):
    """
    Returns the TODA whose area contains `point`, or the nearest one
    within MAX_STATION_DISTANCE_M. Returns None if nothing is close enough.
    """
    max_degrees = MAX_STATION_DISTANCE_M / METERS_PER_DEGREE

    candidates = Toda.objects.filter(area__dwithin=(point, max_degrees))

    # distance is 0 when the point is inside a zone, so containing zones win
    return min(candidates, key=lambda s: s.area.distance(point), default=None)


def calculate_price(start: Point, end: Point, stops=None):
    if stops is None:
        stops = []

    # Only the pickup point decides which TODA (and base fare) applies
    station = find_station(start)
    if not station:
        raise ValueError("Pickup location is outside all TODA service areas.")

    # End and stops are used only to measure the route distance
    route = [start]
    for stop in stops:
        route.append(Point(stop["location"]["lng"], stop["location"]["lat"]))
    route.append(end)

    total_distance = sum(
        haversine_distance(route[i], route[i + 1])
        for i in range(len(route) - 1)
    )

    base_fare = float(station.base_fare)

    if total_distance <= 1:
        price = base_fare
    else:
        price = base_fare + ((total_distance - 1) * RATE_PER_KM)

    price *= get_night_fare_multiplier()

    return round(price)

