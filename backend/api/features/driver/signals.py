from django.db.models.signals import post_save
from django.dispatch import receiver

from ..user.models import Driver
from ..utils.otp import _queue_otp, ROLE_DRIVER


@receiver(post_save, sender=Driver)
def create_driver_otp(sender, instance, created, **kwargs):
    """When a driver is created, cache an OTP and 'send' it to their contact number."""
    if created and not instance.verified:
        _queue_otp(ROLE_DRIVER, instance)