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


def calculate_price(start: Point, end: Point, stops=None):
    """
    Calculates the total fare from the complete route.
    The base fare covers the first kilometer.
    If night fare is enabled and the current PH time is within the
    night window, the total fare is multiplied by the night fare multiplier.
    """

    if stops is None:
        stops = []

    station = Toda.objects.filter(area__contains=start).first()
    if station is None:
        raise ValueError("No TODA station covers the starting location.")

    route = [start]

    for stop in stops:
        route.append(
            Point(
                stop["location"]["lng"],
                stop["location"]["lat"],
            )
        )

    route.append(end)

    total_distance = 0

    for i in range(len(route) - 1):
        total_distance += haversine_distance(
            route[i],
            route[i + 1],
        )

    base_fare = float(station.base_fare)

    if total_distance <= 1:
        price = base_fare
    else:
        price = base_fare + ((total_distance - 1) * RATE_PER_KM)

    price *= get_night_fare_multiplier()

    return round(price)
