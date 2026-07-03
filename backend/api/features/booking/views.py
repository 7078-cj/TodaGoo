from django.core.cache import cache
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes, permission_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from .serializers import BookingSerializer, StopSerializer, DriverQueueSerializer
from .models import Booking, Stop, DriverQueue
from rest_framework.views import APIView
from ..utils.distance import calculate_price
from django.contrib.gis.geos import Point

def get_passenger(user):
    try:
        return user.passenger_profile
        
    except AttributeError:
        return None

class BookingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        passenger = get_passenger(request.user)
        if not passenger:
            return Response({"error": "User is not a passenger"}, status=400)
        bookings = Booking.objects.filter(passenger=passenger)
        serializer = BookingSerializer(bookings, many=True)
        return Response(serializer.data)

    def post(self, request):
        passenger = get_passenger(request.user)
        if not passenger:
            return Response({"error": "User is not a passenger"}, status=400)
        
        user_booking = Booking.objects.filter(passenger=passenger, status__in=['pending', 'in_progress']).first()
        print("User booking:", user_booking)
        if user_booking:
            return Response({"error": "You already have an ongoing or pending booking."}, status=400)

        start = request.data.get("start")
        end = request.data.get("end")

        if not start or not end:
            return Response({"error": "Start and end locations are required"}, status=400)

        start_point = Point(start["lng"], start["lat"])
        end_point = Point(end["lng"], end["lat"])
        price = calculate_price(start_point, end_point)

        request.data["price"] = price
        serializer = BookingSerializer(data=request.data)

        if serializer.is_valid():
            booking = serializer.save(passenger=passenger)
            return Response(
                BookingSerializer(booking).data,
                status=201,
            )

        return Response(serializer.errors, status=400)
    
class BookingDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, booking_id):
        try:
            passenger = get_passenger(request.user)
            if not passenger:
                return Response({"error": "User is not a passenger"}, status=400)
            booking = Booking.objects.get(id=booking_id, passenger=passenger)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        serializer = BookingSerializer(booking)
        return Response(serializer.data)

    def put(self, request, booking_id):
        try:
            passenger = get_passenger(request.user)
            if not passenger:
                return Response({"error": "User is not a passenger"}, status=400)
            booking = Booking.objects.get(id=booking_id, passenger=passenger)
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
            passenger = get_passenger(request.user)
            if not passenger:
                return Response({"error": "User is not a passenger"}, status=400)
            booking = Booking.objects.get(id=booking_id, passenger=passenger)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        booking.delete()
        return Response(status=204)
    
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_bookings(request):
    passenger = get_passenger(request.user)
    if not passenger:
        return Response({"error": "User is not a passenger"}, status=400)

    bookings = Booking.objects.filter(passenger=passenger)
    serializer = BookingSerializer(bookings, many=True)
    return Response(serializer.data)