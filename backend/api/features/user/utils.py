import secrets
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from .models import Notification



def generate_pin():
    # [SEC-C2] secure 6-digit code; password reset now uses utils/password_reset.py
    return f"{secrets.randbelow(10**6):06d}"

def send_reset_email(user, code):
    send_mail(
        "Password Reset Code",
        f"Your password reset code is: {code}",
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
    )

def broadcast_notification(notification, action):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    def _send():
        booking = notification.booking
        payload = {
            "type": "notification_update",
            "action": action,
            # same fields as NotificationSerializer, so the app handles socket and REST items alike
            "notification": {
                "id": notification.id,
                "user_id": notification.user_id,
                "type": notification.type,
                "booking_id": notification.booking_id,
                "booking_status": booking.status if booking else None,
                "message": notification.message,
                "created_at": notification.created_at.isoformat(),
                "read": notification.read,
            },
        }

        async_to_sync(channel_layer.group_send)(f"user_{notification.user_id}", payload)

    transaction.on_commit(_send)

def create_notification(user, message, type=Notification.Type.GENERAL, booking=None):
    notification = Notification.objects.create(user=user, message=message, type=type, booking=booking)
    broadcast_notification(notification, "created")
    return notification
