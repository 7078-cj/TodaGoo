from django.db.models.signals import post_save
from django.dispatch import receiver

from ..user.models import Passenger
from ..utils.otp import _queue_otp, ROLE_PASSENGER



@receiver(post_save, sender=Passenger)
def create_passenger_otp(sender, instance, created, **kwargs):
    """When a passenger is created, cache an OTP and 'send' it to their contact number."""
    if created and not instance.verified:
        _queue_otp(ROLE_PASSENGER, instance)