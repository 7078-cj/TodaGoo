from django.db.models.signals import post_save
from django.dispatch import receiver

from ..chat.models import Message
from ..reports.models import IncidentReport
from .triggers import notify_new_message, notify_reported_user


@receiver(post_save, sender=Message)
def notify_on_new_message(sender, instance, created, **kwargs):
    if created:
        notify_new_message(instance)


@receiver(post_save, sender=IncidentReport)
def notify_on_incident_report(sender, instance, created, **kwargs):
    if created:
        notify_reported_user(instance)
