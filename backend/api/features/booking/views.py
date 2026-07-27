from django.core.cache import cache
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes, permission_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from .serializers import BookingSerializer, StopSerializer, DriverQueueSerializer
from .models import Booking, Stop, DriverQueue,Rate, User
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from ..utils.distance import calculate_price
from django.contrib.gis.geos import Point
from django.core.exceptions import ObjectDoesNotExist

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
def user_bookings(request):
    passenger = get_passenger(request.user)
    if not passenger:
        return Response({"error": "User is not a passenger"}, status=400)

    bookings = Booking.objects.filter(passenger=passenger)
    serializer = BookingSerializer(bookings, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def driver_queue_status(request):
    print(f"[driver_queue_status] request.user={request.user} (id={getattr(request.user, 'id', None)})")

    driver = getattr(request.user, "driver_profile", None)
    print(f"[driver_queue_status] driver_profile={driver}")

    if driver is None:
        print("[driver_queue_status] no driver_profile found, returning not ready")
        return Response({"ready": False}, status=200)

    entry = driver.queue.first()
    print(f"[driver_queue_status] driver_id={driver.id} queue entry={entry}")

    if entry is None:
        print(f"[driver_queue_status] driver_id={driver.id} has no queue entry, not ready")
        return Response(
            {
                "ready": False,
                "driver_id": driver.id,
            },
            status=200,
        )

    print(f"[driver_queue_status] driver_id={driver.id} IS ready, location=({entry.location.y}, {entry.location.x})")
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
        booking_id = request.data.get("booking_id")
        user_id = request.data.get("user_id")
        score = request.data.get("score")

        if not booking_id or not user_id or score is None:
            return Response(
                {"error": "booking_id, user_id, and score are required"},
                status=400,
            )

        booking = Booking.objects.select_related(
            "driver", "driver__user", "passenger", "passenger__user"
        ).filter(id=booking_id).first()

        if booking is None:
            return Response({"error": "Booking not found"}, status=404)

        try:
            score = int(score)
        except (TypeError, ValueError):
            return Response({"error": "score must be a number"}, status=400)

        if not (1 <= score <= 5):
            return Response({"error": "score must be between 1 and 5"}, status=400)

        driver_user_id = getattr(booking.driver, "user_id", None)
        passenger_user_id = getattr(booking.passenger, "user_id", None)

        rated_user_id = int(user_id)

        if rated_user_id == driver_user_id:
            rated_role = "driver"
        elif rated_user_id == passenger_user_id:
            rated_role = "passenger"
        else:
            return Response(
                {"error": "user_id is not a participant in this booking"},
                status=400,
            )

        if request.user.id == rated_user_id:
            return Response({"error": "You cannot rate yourself"}, status=400)

        if request.user.id not in (driver_user_id, passenger_user_id):
            return Response(
                {"error": "You are not a participant in this booking"},
                status=403,
            )

        if Rate.objects.filter(user=request.user, booking=booking).exists():
            return Response(
                {"error": "You have already rated this booking"},
                status=400,
            )

        rated_user = get_object_or_404(User, id=rated_user_id)

        rate = Rate.objects.create(
            user=request.user,
            booking=booking,
            rated_user=rated_user,
            score=score,
        )

        return Response(
            {
                "id": rate.id,
                "booking_id": booking.id,
                "rated_user_id": rated_user.id,
                "rated_role": rated_role,
                "score": rate.score,
            },
            status=201,
        )