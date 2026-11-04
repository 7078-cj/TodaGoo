from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import IncidentReport, IncidentEvidence, REPORT_TAGS
from ..utils.fields import PointField
from ..booking.serializers import BookingSerializer
from ..utils.uploads import validate_file_size, validate_file_count

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
            "tags",
            "status",
            "resolution",
            "resolved_at",
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
    # [SEC-H9] each file size-checked; count checked in validate_evidence_files
    evidence_files = serializers.ListField(
        child=serializers.ImageField(validators=[validate_file_size]),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    tags = serializers.ListField(
        child=serializers.ChoiceField(choices=REPORT_TAGS),
        required=False,
        allow_empty=True,
        max_length=len(REPORT_TAGS),
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
            "tags",
            "status",
            "created_at",
            "evidence",
            "evidence_files",
            "reported_by",
        ]
        read_only_fields = ["id", "status", "created_at", "evidence", "booking", "reported_by"]

    def validate_evidence_files(self, value):
        return validate_file_count(value)

    def validate_tags(self, value):
        return list(dict.fromkeys(value))  # drop duplicates, keep order

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

    CLOSED_STATUSES = {"resolved", "dismissed"}

    class Meta:
        model = IncidentReport
        fields = ["id", "status", "resolution", "resolved_at"]
        read_only_fields = ["id", "resolved_at"]

    def update(self, instance, validated_data):
        new_status = validated_data.get("status", instance.status)
        if new_status in self.CLOSED_STATUSES:
            # stamp the first time it's closed; resolved -> dismissed keeps the original time
            if instance.status not in self.CLOSED_STATUSES or instance.resolved_at is None:
                validated_data["resolved_at"] = timezone.now()
        else:
            validated_data["resolved_at"] = None  # reopened
        return super().update(instance, validated_data)


class IncidentReportAboutMeSerializer(serializers.ModelSerializer):
    """What the reported person may see about a report filed against them: no reporter's account,
    evidence, tags, location or the other party's contact details."""

    route = serializers.SerializerMethodField()

    class Meta:
        model = IncidentReport
        fields = ["id", "incident_types", "status", "created_at", "resolved_at", "resolution", "route"]
        read_only_fields = fields

    def get_route(self, obj):
        return {
            "booking_id": obj.booking_id,
            "start_address": obj.booking.start_address,
            "end_address": obj.booking.end_address,
        }
