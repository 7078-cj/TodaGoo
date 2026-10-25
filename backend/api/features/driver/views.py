from django.core.cache import cache
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User

from ...features.admin.permission import IsAdminProfile
from .serializers import DriverSerializer, DriverStatusSerializer
from .permissions import IsDriverOwnerOrAdmin
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..utils.reconstruction import reconstruct_nested
from rest_framework.response import Response
from django.db.models import Q
from ...pagination import StandardPagination
from ..utils.ProfileUpdateMixIn import ProfileUpdateMixin
from rest_framework.exceptions import ValidationError
from ..utils.otp import (
    check_otp, regenerate_otp,
    OTP_OK, OTP_INVALID, OTP_EXPIRED, OTP_LOCKED,
    RESEND_OK, RESEND_COOLDOWN, RESEND_LIMIT, RESEND_COOLDOWN_SECONDS,
)
from ..user.models import Driver
import re
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes


class DriverListCreateView(ListCreateAPIView):
    queryset = User.objects.filter(driver_profile__isnull=False).select_related(
        "driver_profile", "driver_profile__toda_boundary", "driver_profile__toda_station"
    ).order_by("id")
    serializer_class = DriverSerializer
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsAdminProfile(), IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()

        toda_boundary_id = self.request.query_params.get("toda_boundary")
        if toda_boundary_id:
            qs = qs.filter(driver_profile__toda_boundary_id=toda_boundary_id)

        toda_station_id = self.request.query_params.get("toda_station")
        if toda_station_id:
            qs = qs.filter(driver_profile__toda_station_id=toda_station_id)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        blacklisted = self.request.query_params.get("blacklisted")
        if blacklisted and blacklisted.lower() == "true":
            qs = qs.filter(driver_profile__status="BLACKLISTED")

        min_rating = self.request.query_params.get("min_rating")
        if min_rating:
            try:
                min_rating = float(min_rating)
            except (TypeError, ValueError):
                raise ValidationError({"min_rating": "Must be a number."})
            qs = qs.filter(driver_profile__rating__gte=min_rating)

        max_rating = self.request.query_params.get("max_rating")
        if max_rating:
            try:
                max_rating = float(max_rating)
            except (TypeError, ValueError):
                raise ValidationError({"max_rating": "Must be a number."})
            qs = qs.filter(driver_profile__rating__lte=max_rating)

        return qs

    def create(self, request, *args, **kwargs):
        data = reconstruct_nested(request.data, prefix="driver_profile.")
        serializer = self.get_serializer(data=data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        self.perform_create(serializer)

        cache.delete(f"driver_profile:{serializer.instance.id}")

        return Response(serializer.data, status=201)


class DriverRetrieveUpdateDestroyView(ProfileUpdateMixin, RetrieveUpdateDestroyAPIView):
    queryset = (
        User.objects
        .filter(driver_profile__isnull=False)
        .select_related(
            "driver_profile",
            "driver_profile__toda_boundary",
            "driver_profile__toda_station",
        )
    )
    serializer_class = DriverSerializer
    admin_serializer_class = DriverStatusSerializer
    lookup_field = "pk"
    permission_classes = [IsDriverOwnerOrAdmin, IsAuthenticated]
    profile_prefix = "driver_profile."
    cache_prefix = "driver_profile"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_driver_otp(request):
    """
    POST {"otp": "123456"}
    Verifies the logged-in driver's OTP and sets Driver.verified = True.
    """
    driver = Driver.objects.filter(user=request.user).first()
    if driver is None:
        return Response({"error": "Driver profile not found."}, status=status.HTTP_404_NOT_FOUND)

    if driver.verified:
        return Response({"message": "Driver is already verified."}, status=status.HTTP_200_OK)

    otp = str(request.data.get("otp", "")).strip()
    if not re.fullmatch(r"\d{6}", otp):
        return Response({"error": "OTP must be 6 digits."}, status=status.HTTP_400_BAD_REQUEST)

    result = check_otp(driver.pk, otp)

    if result == OTP_OK:
        driver.verified = True
        driver.save(update_fields=["verified"])
        return Response({"message": "Driver verified."}, status=status.HTTP_200_OK)

    if result == OTP_LOCKED:
        return Response(
            {"error": "Too many wrong attempts. Request a new OTP."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if result == OTP_EXPIRED:
        return Response(
            {"error": "OTP expired or not found. Request a new OTP."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_driver_otp(request):
    """
    POST (no body)
    Replaces the logged-in driver's OTP with a new one and sends it again.
    """
    driver = Driver.objects.filter(user=request.user).first()
    if driver is None:
        return Response({"error": "Driver profile not found."}, status=status.HTTP_404_NOT_FOUND)

    if driver.verified:
        return Response({"error": "Driver is already verified."}, status=status.HTTP_400_BAD_REQUEST)

    result = regenerate_otp(driver.pk, driver.contact_number)

    if result == RESEND_COOLDOWN:
        return Response(
            {
                "error": f"Please wait {RESEND_COOLDOWN_SECONDS} seconds before requesting a new OTP.",
                "retry_after": RESEND_COOLDOWN_SECONDS,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if result == RESEND_LIMIT:
        return Response(
            {"error": "Too many OTP requests. Try again later."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return Response({"message": "A new OTP has been sent."}, status=status.HTTP_200_OK)