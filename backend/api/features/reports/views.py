from rest_framework import permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, RetrieveUpdateAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from ..booking.models import Booking
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError
from  ...pagination import StandardPagination
from ..utils.reconstruction import reconstruct_nested
from rest_framework import status
from ...idempotency import IdempotentAPIView

from .models import IncidentReport
from .serializers import (
    IncidentReportSerializer,
    IncidentReportCreateSerializer,
    IncidentReportStatusUpdateSerializer,
)

from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError


from datetime import timedelta
from django.utils import timezone

INCIDENT_REPORT_WINDOW = timedelta(days=3)

def get_booking_or_404(booking_id, user):
    try:
        booking = Booking.objects.select_related(
            "driver__user", "passenger__user"
        ).get(id=booking_id)
    except Booking.DoesNotExist:
        raise NotFound({"detail": "Booking not found."})

    is_toda_admin = bool(
        getattr(user, "admin", None) and user.admin.department == "TODA"
    )
    is_assigned_driver = bool(booking.driver and booking.driver.user == user)
    is_passenger = bool(booking.passenger and booking.passenger.user == user)


    if not (is_toda_admin or is_assigned_driver or is_passenger):
        raise PermissionDenied(
            {"detail": "You do not have permission to report an incident for this booking."}
        )

    if not is_toda_admin:
        if timezone.now() - booking.created_at > INCIDENT_REPORT_WINDOW:
            raise ValidationError(
                {"detail": "Incidents can only be reported within 3 days of the booking."}
            )

    return booking


class IncidentReportListCreateView(IdempotentAPIView, ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = (
            IncidentReport.objects.select_related(
                "booking",
                "booking__driver",
                "booking__driver__toda_boundary",
                "booking__driver__toda_station",
                "reported_by",
            )
            .prefetch_related("evidence")
        )
        user = self.request.user
        admin = getattr(user, "admin", False)
        if not (admin and admin.department == "TODA"):
            qs = qs.filter(reported_by=user)

        qs = self.apply_filters(qs, admin_qualified=bool(admin and admin.department == "TODA"))
        return qs

    def apply_filters(self, qs, admin_qualified):
        params = self.request.query_params

        toda_boundary_id = params.get("toda_boundary")
        if toda_boundary_id:
            if not admin_qualified:
                raise ValidationError({"toda_boundary": "Only TODA admins may filter by boundary."})
            qs = qs.filter(booking__driver__toda_boundary_id=toda_boundary_id)

        toda_station_id = params.get("toda_station")
        if toda_station_id:
            if not admin_qualified:
                raise ValidationError({"toda_station": "Only TODA admins may filter by station."})
            qs = qs.filter(booking__driver__toda_station_id=toda_station_id)

        status_param = params.get("status")
        if status_param:
            valid_statuses = dict(IncidentReport.STATUS_CHOICES)
            if status_param not in valid_statuses:
                raise ValidationError({"status": f"Must be one of {list(valid_statuses)}."})
            qs = qs.filter(status=status_param)

        incident_type = params.get("incident_types")
        if incident_type:
            valid_types = dict(IncidentReport.INCIDENT_TYPES)
            if incident_type not in valid_types:
                raise ValidationError({"incident_types": f"Must be one of {list(valid_types)}."})
            qs = qs.filter(incident_types=incident_type)

        date_from = params.get("date_from")
        if date_from:
            parsed_from = parse_date(date_from)
            if parsed_from is None:
                raise ValidationError({"date_from": "Must be in YYYY-MM-DD format."})
            qs = qs.filter(created_at__date__gte=parsed_from)

        date_to = params.get("date_to")
        if date_to:
            parsed_to = parse_date(date_to)
            if parsed_to is None:
                raise ValidationError({"date_to": "Must be in YYYY-MM-DD format."})
            qs = qs.filter(created_at__date__lte=parsed_to)

        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return IncidentReportCreateSerializer
        return IncidentReportSerializer

    def create(self, request, *args, **kwargs):
        data = reconstruct_nested(request.data, "location.")

        serializer = self.get_serializer(data=data)
        if not serializer.is_valid():
            serializer.is_valid(raise_exception=True)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        booking_id = self.request.data.get("booking_id")

        booking = get_booking_or_404(booking_id, self.request.user)
        serializer.save(booking=booking)



class IncidentReportRetrieveUpdateView(IdempotentAPIView, RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = (
        IncidentReport.objects.select_related("booking", "reported_by")
        .prefetch_related("evidence")
    )

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return IncidentReportStatusUpdateSerializer
        return IncidentReportSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        admin = getattr(user, "admin", False)
        if not (admin and admin.department == "TODA"):
            qs = qs.filter(reported_by=user)
        return qs

    def perform_update(self, serializer):
        user = self.request.user
        admin = getattr(user, "admin", None)
        if not (admin and admin.department == "TODA"):
            raise PermissionDenied({"detail": "You do not have permission to update this report."})
        serializer.save()