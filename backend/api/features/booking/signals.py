# signals.py
from django.core.cache import cache
import threading
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Booking, Rate
from django.db.models import Avg
from .utils import assign_driver_sync
from ...broadcast import broadcast
from .serializers import BookingSerializer
from api.features.user.models import Driver, Passenger

@receiver(post_save, sender=Rate)
def update_rating_on_rate_created(sender, instance, created, **kwargs):
    if not created:
        return

    rated_user = instance.user

    cache.delete(f"user_ratings:{rated_user.id}")
    cache.delete(f"driver_profile:{rated_user.id}")
    cache.delete(f"passenger_profile:{rated_user.id}")

    driver = getattr(rated_user, 'driver_profile', None)
    if driver is not None:
        avg = Rate.objects.filter(user=rated_user).aggregate(avg=Avg('score'))['avg']
        driver.rating = round(avg, 2) if avg is not None else 0
        driver.save(update_fields=['rating'])
        return

    passenger = getattr(rated_user, 'passenger_profile', None)
    if passenger is not None:
        avg = Rate.objects.filter(user=rated_user).aggregate(avg=Avg('score'))['avg']
        passenger.rating = round(avg, 2) if avg is not None else 0
        passenger.save(update_fields=['rating'])



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