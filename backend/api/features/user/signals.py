from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification

@receiver(post_save, sender=Notification)
def broadcast_notification(sender, instance, created, **kwargs):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    def _send():
        payload = {
            "type": "notification_update",
            "action": "created" if created else "updated",
            "notification": {
                "id": instance.id,
                "user_id": instance.user.id,
                "message": instance.message,
                "created_at": instance.created_at.isoformat(),
                "read": instance.read,
            },
        }

        async_to_sync(channel_layer.group_send)(f"user_{instance.user.id}", payload)

    transaction.on_commit(_send)