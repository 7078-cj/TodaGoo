from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Message
from .serializers import MessageSerializer
from ...broadcast import broadcast


@receiver(post_save, sender=Message)
def broadcast_new_message(sender, instance, created, **kwargs):
    if not created:
        return

    def _send():
        serializer = MessageSerializer(instance)
        broadcast(
            f"booking_{instance.booking_id}",
            "chat_message",
            serializer.data,
        )

    transaction.on_commit(_send)


def broadcast_messages_seen(booking_id, message_ids):
    def _send():
        broadcast(
            f"booking_{booking_id}",
            "messages_seen",
            message_ids,
        )

    transaction.on_commit(_send)