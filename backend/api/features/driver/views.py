from django.core.cache import cache
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User

from ...features.admin.permission import IsAdminProfile
from .serializers import DriverSerializer, DriverStatusSerializer
from .permissions import IsDriverOwnerOrAdmin
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..utils.reconstruction import reconstruct_nested
from rest_framework.response import Response
from ...pagination import StandardPagination
from ..utils.ProfileUpdateMixIn import ProfileUpdateMixin
from ..utils.filtering import apply_user_search_filter, apply_rating_filter
from rest_framework.exceptions import ValidationError
from ..utils.otp import (
    _verify_otp,
    _resend_otp,
    ROLE_DRIVER,
)
from ..user.models import Driver
from rest_framework.decorators import api_view, permission_classes
from rest_framework import status


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
        qs = apply_user_search_filter(qs, search)

        blacklisted = self.request.query_params.get("blacklisted")
        if blacklisted and blacklisted.lower() == "true":
            qs = qs.filter(driver_profile__status="BLACKLISTED")

        return apply_rating_filter(qs, self.request.query_params, "driver_profile__rating")

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

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_profile(request):
    """GET -> returns the authenticated driver's own profile."""
    try:
        user = (
            User.objects
            .select_related(
                "driver_profile",
                "driver_profile__toda_boundary",
                "driver_profile__toda_station",
            )
            .get(pk=request.user.pk, driver_profile__isnull=False)
        )
    except User.DoesNotExist:
        return Response(
            {"detail": "Driver profile not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = DriverSerializer(user, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_driver_otp(request):
    """POST {"otp": "123456"} -> sets Driver.verified = True when it matches."""
    return _verify_otp(request, Driver, ROLE_DRIVER)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_driver_otp(request):
    """POST (no body) -> replaces the driver's OTP and sends it again."""
    return _resend_otp(request, Driver, ROLE_DRIVER)