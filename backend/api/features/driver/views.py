from django.core.cache import cache
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User
from .serializers import DriverSerializer
from .permissions import IsDriverOwnerOrAdmin
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..utils.reconstruction import reconstruct_nested
from rest_framework.response import Response
from django.db.models import Q
from ...pagination import StandardPagination


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


class DriverRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
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
    lookup_field = "pk"
    permission_classes = [IsDriverOwnerOrAdmin, IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get("pk")
        cache_key = f"driver_profile:{pk}"

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().retrieve(request, *args, **kwargs)
        cache.set(cache_key, response.data, 60 * 30)

        return response

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        is_owner = request.user.id == instance.id
        is_toda_admin = (
            getattr(request.user, "admin", None) is not None
            and request.user.admin.department == "TODA"
        )

        data = reconstruct_nested(
            request.data,
            prefix="driver_profile."
        )

        if is_owner:
            pass

        elif is_toda_admin:
            driver_profile_data = data.get("driver_profile", {})
            unauthorized_top_level = set(data.keys()) - {"driver_profile"}
            unauthorized_profile_fields = (
                set(driver_profile_data.keys()) - {"status"}
            )

            if unauthorized_top_level or unauthorized_profile_fields:
                unauthorized_fields = list(unauthorized_top_level)

                unauthorized_fields.extend(
                    f"driver_profile.{field}"
                    for field in unauthorized_profile_fields
                )

                return Response(
                    {
                        "detail": (
                            "TODA admins can only update the driver's status."
                        ),
                        "unauthorized_fields": unauthorized_fields,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            return Response(
                {
                    "detail": "You do not have permission to update this driver."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(
            instance,
            data=data,
            partial=partial
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        cache.delete(f"driver_profile:{instance.pk}")

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        pk = instance.pk

        response = super().destroy(request, *args, **kwargs)

        cache.delete(f"driver_profile:{pk}")

        return response