from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import IncidentReport
from .serializers import IncidentReportSerializer

MDRRMO_INCIDENT_TYPES = {"accident", "reckless_driving", "others"}


@receiver(post_save, sender=IncidentReport)
def broadcast_incident_report(sender, instance, created, **kwargs):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    def _send():
        serializer = IncidentReportSerializer(instance)
        payload = {
            "type": "incident_report_update",
            "action": "created" if created else "updated",
            "report": serializer.data,
        }

        async_to_sync(channel_layer.group_send)("admin_TODA", payload)

        if instance.incident_types in MDRRMO_INCIDENT_TYPES:
            async_to_sync(channel_layer.group_send)("admin_MDRRMO", payload)

    transaction.on_commit(_send)