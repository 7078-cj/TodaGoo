from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .helpers.driver_availability import broadcast_driver_availability
from .models import DriverQueue


@receiver(post_save, sender=DriverQueue)
def driver_queued(sender, instance, created, **kwargs):
    if created:
        broadcast_driver_availability()


@receiver(post_delete, sender=DriverQueue)
def driver_dequeued(sender, instance, **kwargs):
    broadcast_driver_availability()
