from django.contrib.gis.geos import Point
from math import radians, sin, cos, sqrt, atan2

BASE_FARE = 30        # pesos
RATE_PER_KM = 10      # pesos per km


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
    """

    if stops is None:
        stops = []

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

    price = BASE_FARE + (total_distance * RATE_PER_KM)

    return round(price)