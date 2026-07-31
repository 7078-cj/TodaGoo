from django.contrib.gis.db.models.functions import Distance
from ..models import DriverQueue

def get_nearest_driver(toda, toda_station, exclude_driver_ids, booking):
    base_qs = (
        DriverQueue.objects
        .select_for_update(of=("self",), skip_locked=True)
        .select_related("driver", "driver__user")
        .filter(driver__status="ACTIVE")
        .exclude(driver_id__in=exclude_driver_ids)
    )

    nearest = (
        base_qs
        .filter(driver__toda_boundary=toda, driver__toda_station=toda_station)
        .annotate(distance=Distance("location", booking.start, geography=True))
        .order_by("distance")
        .first()
    )

    if nearest is None:
        nearest = (
            base_qs
            .filter(driver__toda_boundary=toda)
            .annotate(distance=Distance("location", booking.start, geography=True))
            .order_by("distance")
            .first()
        )

    return nearest