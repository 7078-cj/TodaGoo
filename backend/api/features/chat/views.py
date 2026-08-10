from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListCreateAPIView
from rest_framework.views import APIView
from rest_framework.response import Response

from ..booking.models import Booking
from .models import Message
from .serializers import MessageSerializer
from .signals import broadcast_messages_seen
from ...pagination import StandardPagination


def get_booking_participant_or_403(booking_id, user):
    booking = get_object_or_404(
        Booking.objects.select_related("driver__user", "passenger__user").filter(
            status__in=["in_progress", "accepted"]
        ),
        id=booking_id,
    )

    is_passenger = bool(booking.passenger and booking.passenger.user == user)
    is_driver = bool(booking.driver and booking.driver.user == user)

    if not (is_passenger or is_driver):
        raise PermissionDenied({"detail": "You are not a participant in this booking."})

    return booking, is_passenger


class MessageListCreateView(ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        booking_id = self.request.query_params.get("booking_id") or self.request.data.get("booking_id")
        if not booking_id:
            raise ValidationError({"booking_id": "This field is required."})

        booking, _ = get_booking_participant_or_403(booking_id, self.request.user)

        return (
            Message.objects.filter(booking=booking)
            .select_related("sender", "receiver")
        )

    def perform_create(self, serializer):
        booking_id = self.request.data.get("booking_id")
        if not booking_id:
            raise ValidationError({"booking_id": "This field is required."})

        booking, is_passenger = get_booking_participant_or_403(booking_id, self.request.user)

        if is_passenger:
            if not booking.driver:
                raise ValidationError({"detail": "This booking has no assigned driver yet."})
            receiver = booking.driver.user
        else:
            receiver = booking.passenger.user

        serializer.save(booking=booking, sender=self.request.user, receiver=receiver)


class MarkMessagesSeenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        booking_id = request.data.get("booking_id")
        if not booking_id:
            raise ValidationError({"booking_id": "This field is required."})

        booking, _ = get_booking_participant_or_403(booking_id, request.user)

        unseen_ids = list(
            Message.objects.filter(
                booking=booking, receiver=request.user, seen=False
            ).values_list("id", flat=True)
        )

        if not unseen_ids:
            return Response({"seen_ids": []}, status=200)

        Message.objects.filter(id__in=unseen_ids).update(seen=True)

        broadcast_messages_seen(booking.id, unseen_ids)

        return Response({"seen_ids": unseen_ids}, status=200)