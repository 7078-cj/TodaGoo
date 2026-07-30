from django.db import transaction
from django.contrib.gis.db.models.functions import Distance
from django.core.cache import cache

from .models import Booking, DriverQueue
from ..admin.models import Toda, TodaStation
from ...broadcast import broadcast
from .serializers import BookingSerializer

import time


def get_nearest_toda(booking):
    start = booking.start

    toda = Toda.objects.filter(area__contains=start).first()
    if toda:
        return toda

    return (
        Toda.objects
        .annotate(distance=Distance("area", start))
        .order_by("distance")
        .first()
    )

def get_nearest_toda_station(booking):
    start = booking.start

    toda = (
        TodaStation.objects
        .annotate(distance=Distance("location", start))
        .order_by("distance")
        .first()
    )
    if toda:
        return toda

    return (
        TodaStation.objects
        .annotate(distance=Distance("location", booking.end))
        .order_by("distance")
        .first()
    )


def assign_driver_sync(booking_id, exclude_driver_ids=None):
    if exclude_driver_ids is None:
        exclude_driver_ids = []

    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            return

        if booking.status != Booking.Status.PENDING or booking.driver_id is not None:
            return

        toda = get_nearest_toda(booking)
        if toda is None:
            return

        toda_station = get_nearest_toda_station(booking)
        if toda_station is None:
            return

        base_qs = (
            DriverQueue.objects
            .select_for_update(of=("self",), skip_locked=True)
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

        data = BookingSerializer(booking).data

        if nearest:
            driver_id = nearest.driver.id
            driver_user_id = nearest.driver.user.id
            location = {"lat": nearest.location.y, "lng": nearest.location.x}

            nearest.delete()  

            def _on_commit():
                expires_at = time.time() + 30
                data_with_expiry = {**data, "expires_at": expires_at}

                cache.set(f'driver_{driver_id}_location', location, timeout=40)
                cache.set(f'driver_{driver_id}_booking', data_with_expiry, timeout=30)
                broadcast(f'driver_{driver_user_id}', 'new_booking', data_with_expiry)


            transaction.on_commit(_on_commit)

        else:
            user_id = booking.passenger.user.id
            b_id = booking.id
            booking.delete()

            transaction.on_commit(
                lambda: broadcast(
                    f"user_{user_id}",
                    "booking_unavailable",
                    {"booking_id": b_id, "message": "No drivers are currently available."},
                )
            )