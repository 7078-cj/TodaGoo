from django.db import models
from django.contrib.auth.models import User
from ..booking.models import Booking
from django.contrib.gis.db import models as geomodels

class IncidentReport(models.Model):
    INCIDENT_TYPES = [
        ("accident", "Accident"),
        ("overcharging", "Overcharging"),
        ("reckless_driving", "Reckless Driving"),
        ("harassment", "Harassment"),
        ("lost_item", "Lost Item"),
        ("others", "Others"),
    ]

    INJURED_CHOICES = [
        ("passenger", "Me (Passenger)"),
        ("driver", "Driver"),
        ("others", "Others"),
        ("none", "None"),
    ]

    STATUS_CHOICES = [
        ("open", "Open"),
        ("resolved", "Resolved"),
        ("dismissed", "Dismissed"),
    ]

    booking = models.ForeignKey(Booking, on_delete=models.PROTECT, related_name="incident_reports")
    reported_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    location = geomodels.PointField(geography=True)
    incident_types = models.CharField(max_length=20, choices=INCIDENT_TYPES, default="none")
    injured_party = models.CharField(max_length=20, choices=INJURED_CHOICES, default="none")
    details = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="open",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Incident #{self.id} — booking {self.booking_id}"


def incident_evidence_path(instance, filename):
    return f"incident_evidence/{instance.report_id}/{filename}"


class IncidentEvidence(models.Model):
    report = models.ForeignKey(IncidentReport, on_delete=models.CASCADE, related_name="evidence")
    file = models.ImageField(upload_to=incident_evidence_path)
    uploaded_at = models.DateTimeField(auto_now_add=True)