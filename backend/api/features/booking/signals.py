# signals.py
import threading
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Booking
from .utils import assign_driver_sync
from ...broadcast import broadcast
from .serializers import BookingSerializer



@receiver(post_save, sender=Booking)
def trigger_driver_assignment(sender, instance, created, **kwargs):
    if created and instance.status == Booking.Status.PENDING and instance.driver_id is None:
        transaction.on_commit(
            lambda: threading.Thread(target=assign_driver_sync, args=(instance.id,), daemon=True).start()
        )

@receiver(post_save, sender=Booking)
def booking_updated(sender, instance, created, **kwargs):
    if created:
        return

    if instance.status == Booking.Status.ACCEPTED or instance.status == Booking.Status.IN_PROGRESS or instance.status == Booking.Status.COMPLETED:
        transaction.on_commit(
            lambda: broadcast(
                f"user_{instance.passenger.user.id}",
                "booking_accepted",
                BookingSerializer(instance).data,
            )
        )
        transaction.on_commit(
            lambda: broadcast(
                f"driver_{instance.driver.user.id}",
                "booking_update",
                BookingSerializer(instance).data,
            )
        )