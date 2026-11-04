from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from ..chat.models import Message
from ..reports.models import IncidentReport
from .triggers import notify_new_message, notify_report_status_changed, notify_reported_user


@receiver(post_save, sender=Message)
def notify_on_new_message(sender, instance, created, **kwargs):
    if created:
        notify_new_message(instance)


@receiver(post_save, sender=IncidentReport)
def notify_on_incident_report(sender, instance, created, **kwargs):
    if created:
        notify_reported_user(instance)


@receiver(pre_save, sender=IncidentReport)
def remember_report_status(sender, instance, **kwargs):
    # the status before this save, so post_save can tell it changed
    instance._previous_status = (
        IncidentReport.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
        if instance.pk else None
    )


@receiver(post_save, sender=IncidentReport)
def notify_on_report_status_change(sender, instance, created, **kwargs):
    if not created:
        notify_report_status_changed(instance, getattr(instance, "_previous_status", None))
