from django.core.cache import cache
from requests import Response
from rest_framework.decorators import api_view, throttle_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from .serializers import BookingSerializer, StopSerializer, DriverQueueSerializer
from .models import Booking, Stop, DriverQueue
from rest_framework.views import APIView

class BookingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bookings = Booking.objects.filter(passenger=request.user)
        serializer = BookingSerializer(bookings, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = BookingSerializer(data=request.data)

        if serializer.is_valid():
            booking = serializer.save(passenger=request.user)
            return Response(
                BookingSerializer(booking).data,
                status=201,
            )

        return Response(serializer.errors, status=400)
    
class BookingDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id, passenger=request.user)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        serializer = BookingSerializer(booking)
        return Response(serializer.data)

    def put(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id, passenger=request.user)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        status = request.data.get("status")
        if status is not None:
            booking.status = status
            booking.save()
        else:
            return Response({"error": "Status is required"}, status=400)

        return Response(BookingSerializer(booking).data)

    def delete(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id, passenger=request.user)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        booking.delete()
        return Response(status=204)