from django.core.cache import cache
from rest_framework.decorators import api_view, throttle_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User
from .serializers import PassengerSerializer, PassengerStatusSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..utils.reconstruction import reconstruct_nested
from rest_framework.response import Response
from .permissions import IsPassengerOwnerOrAdmin
from ...pagination import StandardPagination
from django.db.models import Q
from ..utils.ProfileUpdateMixIn import ProfileUpdateMixin

class PassengerListCreateView(ListCreateAPIView):
    queryset = User.objects.filter(passenger_profile__isnull=False).select_related(
        "passenger_profile"
    )
    serializer_class = PassengerSerializer
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsPassengerOwnerOrAdmin(), IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        min_rating = self.request.query_params.get("min_rating")
        if min_rating:
            try:
                min_rating = float(min_rating)
            except (TypeError, ValueError):
                raise ValidationError({"min_rating": "Must be a number."})
            qs = qs.filter(passenger_profile__rating__gte=min_rating)

        max_rating = self.request.query_params.get("max_rating")
        if max_rating:
            try:
                max_rating = float(max_rating)
            except (TypeError, ValueError):
                raise ValidationError({"max_rating": "Must be a number."})
            qs = qs.filter(passenger_profile__rating__lte=max_rating)

        return qs

    def create(self, request, *args, **kwargs):
        data = reconstruct_nested(request.data, prefix="passenger_profile.")

        serializer = self.get_serializer(data=data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        self.perform_create(serializer)

        cache.delete(f"passenger_profile:{serializer.instance.id}")

        return Response(serializer.data, status=201)


class PassengerRetrieveUpdateDestroyView(ProfileUpdateMixin, RetrieveUpdateDestroyAPIView):
    queryset = User.objects.filter(passenger_profile__isnull=False).select_related('passenger_profile')
    serializer_class = PassengerSerializer
    admin_serializer_class = PassengerStatusSerializer
    lookup_field = 'pk'
    permission_classes =  [IsPassengerOwnerOrAdmin, IsAuthenticated]
    profile_prefix = "passenger_profile."
    cache_prefix = "passenger_profile"
