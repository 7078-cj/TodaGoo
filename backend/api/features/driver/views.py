from django.core.cache import cache
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User
from .serializers import DriverSerializer, DriverStatusSerializer
from .permissions import IsDriverOwnerOrAdmin
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..utils.reconstruction import reconstruct_nested
from rest_framework.response import Response
from django.db.models import Q
from ...pagination import StandardPagination
from ..utils.ProfileUpdateMixIn import ProfileUpdateMixin


class DriverListCreateView(ListCreateAPIView):
    queryset = User.objects.filter(driver_profile__isnull=False).select_related(
        "driver_profile", "driver_profile__toda_boundary", "driver_profile__toda_station"
    )
    serializer_class = DriverSerializer
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsDriverOwnerOrAdmin(), IsAuthenticated()]

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