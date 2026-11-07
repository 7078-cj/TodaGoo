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
import logging
logger = logging.getLogger(__name__)


@receiver(post_save, sender=Rate)
def update_rating_on_rate_created(sender, instance, created, **kwargs):
    if not created:
        return

    rated_user = instance.user

    cache.delete(f"user_ratings:{rated_user.id}")
    cache.delete(f"driver_profile:{rated_user.id}")
    cache.delete(f"passenger_profile:{rated_user.id}")

    driver = getattr(rated_user, 'driver_profile', None)
    passenger = getattr(rated_user, 'passenger_profile', None)
    profile = driver if driver is not None else passenger

    if profile is not None:
        avg = Rate.objects.filter(user=rated_user).aggregate(avg=Avg('score'))['avg']
        profile.rating = round(avg, 2) if avg is not None else 0
        profile.save(update_fields=['rating'])



def _run_assignment(booking_id):
    try:
        logger.info("Assigning driver for booking %s", booking_id)
        assign_driver_sync(booking_id)
    except Exception:
        logger.exception("Driver assignment failed for booking %s", booking_id)


@receiver(post_save, sender=Booking)
def trigger_driver_assignment(sender, instance, created, **kwargs):
    logger.info("Booking post_save: id=%s created=%s status=%s driver_id=%s",
                instance.id, created, instance.status, instance.driver_id)
    if created and instance.status == Booking.Status.PENDING and instance.driver_id is None:
        transaction.on_commit(
            lambda: threading.Thread(target=_run_assignment, args=(instance.id,), daemon=True).start()
        )

@receiver(post_save, sender=Booking)
def booking_updated(sender, instance, created, **kwargs):
    logger.info("Booking updated: id=%s status=%s", instance.id, instance.status)
    if created:
        return

    # CANCELLED: the passenger cancelled before pickup; both apps leave the trip screen
    if instance.status in (
        Booking.Status.ACCEPTED, Booking.Status.IN_PROGRESS, Booking.Status.COMPLETED, Booking.Status.CANCELLED,
    ) and instance.driver_id is not None:
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