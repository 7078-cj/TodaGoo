from rest_framework import generics, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from ..booking.models import Booking
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError
from  ...pagination import StandardPagination
from ..utils.reconstruction import reconstruct_nested
from rest_framework import status

from .models import IncidentReport
from .serializers import (
    IncidentReportSerializer,
    IncidentReportCreateSerializer,
    IncidentReportStatusUpdateSerializer,
)

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




class IncidentReportListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = (
            IncidentReport.objects.select_related("booking", "reported_by")
            .prefetch_related("evidence")
        )
        user = self.request.user
        admin = getattr(user, "admin", False)
        if not (admin and admin.department == "TODA"):
            qs = qs.filter(reported_by=user)
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



class IncidentReportRetrieveUpdateView(generics.RetrieveUpdateAPIView):
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