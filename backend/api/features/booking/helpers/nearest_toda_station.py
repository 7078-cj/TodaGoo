from ...admin.models import TodaStation
from django.contrib.gis.db.models.functions import Distance


def get_nearest_toda_station(booking):
    nearest_to_start = (
        TodaStation.objects
        .annotate(distance=Distance("location", booking.start, geography=True))
        .order_by("distance")
        .first()
    )

    nearest_to_end = (
        TodaStation.objects
        .annotate(distance=Distance("location", booking.end, geography=True))
        .order_by("distance")
        .first()
    )

    if nearest_to_start is None:
        return nearest_to_end
    if nearest_to_end is None:
        return nearest_to_start

    return nearest_to_start if nearest_to_start.distance <= nearest_to_end.distance else nearest_to_end
