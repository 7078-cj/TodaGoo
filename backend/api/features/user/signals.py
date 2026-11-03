from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification
from .utils import broadcast_notification

@receiver(post_save, sender=Notification)
def broadcast_notification_update(sender, instance, created, **kwargs):
    # creations are broadcast by utils.create_notification
    if created:
        return
    broadcast_notification(instance, "updated")
