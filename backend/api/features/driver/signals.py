# Add to your existing signals file (keep your current imports and receivers).
from django.core.cache import cache
from django.db import transaction
from django.db.models import Avg
from django.db.models.signals import post_save
from django.dispatch import receiver

from ..user.models import Driver
from ..utils.otp import issue_and_send_otp   # adjust to where you put otp.py


@receiver(post_save, sender=Driver)
def create_driver_otp(sender, instance, created, **kwargs):
    """When a driver is created, cache an OTP and 'send' it to their contact number."""
    if not created or instance.verified:
        return

    driver_id = instance.pk
    contact_number = instance.contact_number

    # Only after the DB transaction commits, so a rolled-back registration leaves no OTP behind
    transaction.on_commit(lambda: issue_and_send_otp(driver_id, contact_number))