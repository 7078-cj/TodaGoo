
from django.db import transaction
from django.contrib.gis.db.models.functions import Distance
from .models import Booking, DriverQueue
from django.contrib.gis.db.models.functions import Distance
from ..admin.models import Toda
from ...broadcast import broadcast
from .serializers import BookingSerializer

def get_nearest_toda(booking):
    end = booking.end

    
    toda = Toda.objects.filter(area__contains=end).first()
    if toda:
        return toda

    return (
        Toda.objects
        .annotate(distance=Distance("area", end))
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

        base_qs = (
            DriverQueue.objects
            .select_for_update(of=("self",), skip_locked=True)
            .filter(driver__status="ACTIVE")
            .exclude(driver_id__in=exclude_driver_ids)
        )

        nearest = (
            base_qs
            .filter(driver__toda_station=toda)
            .annotate(distance=Distance("location", booking.end))
            .order_by("distance")
            .first()
        )

        if nearest is None:
            nearest = (
                base_qs
                .annotate(distance=Distance("location", booking.start))
                .order_by("distance","created_at")
                .first()
            )

        data = BookingSerializer(booking).data

        if nearest:
            broadcast(f'driver_{nearest.driver.user.id}','new_booking', data )
            nearest.delete()
            
        else:
            user_id = booking.passenger.user.id
            booking_id = booking.id

            booking.delete()

            broadcast(
                f"user_{user_id}",
                "booking_unavailable",
                {
                    "booking_id": booking_id,
                    "message": "No drivers are currently available.",
                },
            )