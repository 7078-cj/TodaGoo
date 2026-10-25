from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User
from .serializers import PassengerSerializer, PassengerStatusSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..utils.reconstruction import reconstruct_nested
from rest_framework.response import Response
from .permissions import IsPassengerOwnerOrAdmin
from ...pagination import StandardPagination
from ..utils.ProfileUpdateMixIn import ProfileUpdateMixin
from ..utils.filtering import apply_user_search_filter, apply_rating_filter
from rest_framework.exceptions import ValidationError
from ...features.admin.permission import IsAdminProfile
from ..utils.otp import (
    _verify_otp,
    _resend_otp,
    ROLE_PASSENGER,
)
from ..user.models import Passenger

class PassengerListCreateView(ListCreateAPIView):
    queryset = User.objects.filter(passenger_profile__isnull=False).select_related(
        "passenger_profile"
    ).order_by("id")
    serializer_class = PassengerSerializer
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsAdminProfile(), IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()

        search = self.request.query_params.get("search")
        qs = apply_user_search_filter(qs, search)

        return apply_rating_filter(qs, self.request.query_params, "passenger_profile__rating")

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

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_passenger_otp(request):
    """POST {"otp": "123456"} -> sets Passenger.verified = True when it matches."""
    return _verify_otp(request, Passenger, ROLE_PASSENGER)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_passenger_otp(request):
    """POST (no body) -> replaces the passenger's OTP and sends it again."""
    return _resend_otp(request, Passenger, ROLE_PASSENGER)
