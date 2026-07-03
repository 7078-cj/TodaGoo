from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Booking

@receiver(pre_save, sender=Booking)
def get_driver_queue(sender, instance, **kwargs):
    if instance.status == 'pending' and instance.driver is None:
        driver_queue = instance.driver_queue.first()
        if driver_queue:
            instance.driver = driver_queue.driver
            driver_queue.delete()