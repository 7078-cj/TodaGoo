from django.db import transaction
from rest_framework import serializers

from ..booking.models import Booking
from .models import IncidentReport, IncidentEvidence
from ..booking.serializers import PointField
from ..booking.serializers import BookingSerializer

class IncidentEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentEvidence
        fields = ["id", "file", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]


class IncidentReportSerializer(serializers.ModelSerializer):
    """Read serializer — used for list/retrieve."""

    location = PointField()
    evidence = IncidentEvidenceSerializer(many=True, read_only=True)
    reported_by = serializers.PrimaryKeyRelatedField(read_only=True)
    booking = BookingSerializer(read_only=True)

    class Meta:
        model = IncidentReport
        fields = [
            "id",
            "booking",
            "reported_by",
            "location",
            "incident_types",
            "injured_party",
            "details",
            "status",
            "created_at",
            "evidence",
        ]
        read_only_fields = fields


class IncidentReportCreateSerializer(serializers.ModelSerializer):
    """Write serializer — used for POST. Accepts multipart evidence files."""

    location = PointField()
    booking = BookingSerializer(read_only=True)
    booking_id = serializers.IntegerField(write_only=True)
    reported_by = serializers.PrimaryKeyRelatedField(read_only=True)
    evidence = IncidentEvidenceSerializer(many=True, read_only=True)
    evidence_files = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = IncidentReport
        fields = [
            "id",
            "booking",
            "booking_id",
            "location",
            "incident_types",
            "injured_party",
            "details",
            "status",
            "created_at",
            "evidence",
            "evidence_files",
            "reported_by",
        ]
        read_only_fields = ["id", "status", "created_at", "evidence", "booking", "reported_by"]

    def create(self, validated_data):
        validated_data.pop("booking_id", None)
        evidence_files = validated_data.pop("evidence_files", [])
        request = self.context.get("request")
        reported_by = (
            request.user if request and request.user.is_authenticated else None
        )

        with transaction.atomic():
            report = IncidentReport.objects.create(
                reported_by=reported_by, **validated_data
            )
            if evidence_files:
                IncidentEvidence.objects.bulk_create(
                    [IncidentEvidence(report=report, file=f) for f in evidence_files]
                )

        return report


class IncidentReportStatusUpdateSerializer(serializers.ModelSerializer):
    """Restricted update serializer — for MDRRMO/staff resolving reports.
    Passengers shouldn't be able to rewrite location/details after submission."""

    class Meta:
        model = IncidentReport
        fields = ["id", "status"]
        read_only_fields = ["id"]