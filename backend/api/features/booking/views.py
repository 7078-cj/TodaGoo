from django.core.cache import cache
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes, permission_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from .serializers import BookingSerializer, StopSerializer, DriverQueueSerializer, RateCreateSerializer, RateSerializer
from .models import Booking, Stop, DriverQueue,Rate, User
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from ..utils.distance import calculate_price
from django.contrib.gis.geos import Point
from django.core.exceptions import ObjectDoesNotExist
from ...idempotency import IdempotentAPIView
from  ...pagination import StandardPagination
from datetime import datetime
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

def get_passenger(user):
    try:
        return user.passenger_profile
    except ObjectDoesNotExist:
        return None

def get_driver(user):
    try:
        return user.driver_profile
    except ObjectDoesNotExist:
        return None
        

def is_toda_admin(user):
    return bool(
        user
        and user.is_authenticated
        and hasattr(user, "admin")
        and user.admin.department == "TODA"
    )


class BookingView(IdempotentAPIView, APIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination

    def get(self, request):
        qs = Booking.objects.select_related(
            "passenger__user", "driver__user"
        ).prefetch_related("stops", "ratings")

        if is_toda_admin(request.user):
            bookings = qs.all()
        else:
            passenger = get_passenger(request.user)
            if passenger:
                bookings = qs.filter(passenger=passenger)
            else:
                driver = get_driver(request.user)
                bookings = qs.filter(driver=driver)

        bookings = self.apply_filters(bookings, request, is_admin=is_toda_admin(request.user))

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(bookings, request, view=self)
        serializer = BookingSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def apply_filters(self, qs, request, is_admin):
        toda_boundary_id = request.query_params.get("toda_boundary")

        if toda_boundary_id:
            if not is_admin:
                raise ValidationError({"toda_boundary": "Only TODA admins may filter by boundary."})
            qs = qs.filter(driver__toda_boundary_id=toda_boundary_id)

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if date_from:
            parsed_from = parse_date(date_from)
            if parsed_from is None:
                raise ValidationError({"date_from": "Must be in YYYY-MM-DD format."})
            qs = qs.filter(created_at__date__gte=parsed_from)

        if date_to:
            parsed_to = parse_date(date_to)
            if parsed_to is None:
                raise ValidationError({"date_to": "Must be in YYYY-MM-DD format."})
            qs = qs.filter(created_at__date__lte=parsed_to)

        return qs
    
    def post(self, request):
    
        passenger = get_passenger(request.user)
        if not passenger:
            return Response({"error": "User is not a passenger"}, status=400)
        
        user_booking = Booking.objects.filter(passenger=passenger, status__in=['pending', 'in_progress']).first()
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
    
class BookingDetailView(IdempotentAPIView,APIView):
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

    ALLOWED_TRANSITIONS = {
        "accepted": "in_progress",
        "in_progress": "completed",
    }

    def put(self, request, booking_id):
        try:
            driver = get_driver(request.user)
            if not driver:
                return Response({"error": "User is not a driver"}, status=400)
            booking = Booking.objects.get(id=booking_id, driver=driver)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        new_status = request.data.get("status")
        if new_status is None:
            return Response({"error": "Status is required"}, status=400)

        expected_next = self.ALLOWED_TRANSITIONS.get(booking.status)
        if new_status != expected_next:
            return Response(
                {"error": f"Cannot transition booking from '{booking.status}' to '{new_status}'"},
                status=400,
            )

        booking.status = new_status
        booking.save()

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
def driver_queue_status(request):

    driver = getattr(request.user, "driver_profile", None)

    if driver is None:
        return Response({"ready": False}, status=200)

    entry = driver.queue.first()

    if entry is None:
        return Response(
            {
                "ready": False,
                "driver_id": driver.id,
            },
            status=200,
        )

    return Response(
        {
            "ready": True,
            "driver_id": driver.id,
            "location": {"lat": entry.location.y, "lng": entry.location.x},
        },
        status=200,
    )

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def driver_queue(request):
    driver = getattr(request.user, "driver_profile", None)
    if driver is None:
        return Response({"error": "no driver profile for this user"}, status=403)
    
    if driver.status == "BLACKLISTED":
        return Response({"error": "driver is blacklisted"}, status=403)

    lat = request.data.get("lat")
    lng = request.data.get("lng")

    if lat is None or lng is None:
        return Response({"error": "lat and lng are required"}, status=400)

    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return Response({"error": "lat and lng must be numeric"}, status=400)

    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return Response({"error": "lat/lng out of range"}, status=400)

    location = Point(lng, lat)

    exists = request.user.driver_profile.queue.exists()

    if not exists:
        DriverQueue.objects.create(
            driver=driver,
            location=location
        )
    else:
        return Response({"error": "user already in queue"}, status=400)

    return Response(
        {
            "driver_id": driver.id,
            "location": {"lat": lat, "lng": lng},
        },
        status=200,
    )

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def driver_dequeue(request):
    driver = getattr(request.user, "driver_profile", None)
    print(driver)
    if driver is None:
        return Response({"error": "no driver profile for this user"}, status=403)

    deleted_count, _ = DriverQueue.objects.filter(driver=driver).delete()

    if deleted_count == 0:
        return Response({"error": "driver was not in queue"}, status=404)

    return Response(status=204)

class RateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):

        serializer = RateCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        rate = serializer.save()

        return Response(
            {
                "id": rate.id,
                "booking_id": rate.booking_id,
                "rated_user_id": rate.user_id,
                "rated_role": rate.rated_role,
                "score": rate.score,
                "feedback": rate.feedback,
            },
            status=201,
        )

    def get(self, request):
        """Return feedback/ratings received by the currently logged-in user."""
        rates = (
            Rate.objects.select_related("booking", "booking__driver", "user", "rater")
            .filter(user_id=request.user.id)
            .order_by("-created_at")
        )
        serializer = RateSerializer(rates, many=True)
        return Response(serializer.data, status=200)