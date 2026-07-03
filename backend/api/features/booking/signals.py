from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Booking, DriverQueue

from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.contrib.gis.db.models.functions import Distance

from .models import Booking, DriverQueue


@receiver(pre_save, sender=Booking)
def get_driver_queue(sender, instance, **kwargs):
    if instance.status != Booking.Status.PENDING:
        return

    if instance.driver is not None:
        return

    nearest = (
        DriverQueue.objects
        .annotate(distance=Distance("location", instance.start))
        .order_by("distance")
        .first()
    )

    if nearest:
        instance.driver = nearest.driver
        nearest.delete()