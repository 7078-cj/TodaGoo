from django.contrib.gis.geos import Point
from django.core.cache import cache

from ...utils.distance import haversine_distance
from ...utils.security import parse_lat_lng

# How close the driver must be to the pickup point to start the ride.
# Also used for the "driver is near" notification so both happen at the same moment.
PICKUP_RADIUS_M = 150


def distance_to_pickup_m(booking, lat, lng):
    return haversine_distance(Point(lng, lat, srid=4326), booking.start) * 1000


def is_near_pickup(booking, lat, lng):
    return distance_to_pickup_m(booking, lat, lng) <= PICKUP_RADIUS_M


def get_driver_coords(booking_id, location=None):
    """
    The driver's position as (lat, lng): the location sent with the request, or else
    the last one the driver's booking socket broadcast (cached for 20 s). None if neither.
    """
    coords = parse_lat_lng(location, lat_key="latitude", lng_key="longitude")
    if coords is not None:
        return coords

    cached = cache.get(f"booking_{booking_id}_driver_location")
    return parse_lat_lng(
        cached.get("coords") if isinstance(cached, dict) else None,
        lat_key="latitude",
        lng_key="longitude",
    )
