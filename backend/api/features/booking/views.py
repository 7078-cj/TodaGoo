from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework import permissions
from .serializers import (
    BookingSerializer,
    StopSerializer,
    DriverQueueSerializer,
    RateCreateSerializer,
    RateSerializer,
    BookingHistorySerializer,
    Message
)
from .models import Booking, DriverQueue, Rate
from rest_framework.views import APIView
from ..utils.distance import calculate_price
from django.contrib.gis.geos import Point
from django.core.exceptions import ObjectDoesNotExist
from ...idempotency import IdempotentAPIView
from ...pagination import StandardPagination
from ..utils.filtering import apply_date_range_filter
from rest_framework.exceptions import ValidationError

from ..utils.roles import is_toda_admin
from ..utils.security import validate_booking_payload, DRIVER_PENDING
from .helpers.pickup_proximity import PICKUP_RADIUS_M, distance_to_pickup_m, get_driver_coords
from django.db import transaction
from django.db.models import Prefetch
from ..notifications.triggers import notify_booking_cancelled
from .logs import log_cancelled_by_passenger, log_completed, log_picked_up

# [SEC-M12] statuses that count as "the passenger already has a booking"
ACTIVE_BOOKING_STATUSES = ['pending', 'accepted', 'in_progress']
# [SEC-M11] a passenger may only delete a booking that no driver has taken yet
DELETABLE_BOOKING_STATUSES = ['pending']
# statuses shown in the ride history screen
HISTORY_BOOKING_STATUSES = ['completed', 'cancelled']

def get_passenger(user):
    return getattr(user, "passenger_profile", None)

def get_driver(user):
    return getattr(user, "driver_profile", None)


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

        return apply_date_range_filter(qs, request.query_params)
    
    def post(self, request):
        passenger = get_passenger(request.user)
        if not passenger:
            return Response({"error": "User is not a passenger"}, status=400)

        user_booking = Booking.objects.filter(
            passenger=passenger, status__in=ACTIVE_BOOKING_STATUSES
        ).first()
        if user_booking:
            return Response({"error": "You already have an ongoing or pending booking."}, status=400)

        start = request.data.get("start")
        end = request.data.get("end")

        if not start or not end:
            return Response({"error": "Start and end locations are required"}, status=400)

        try:
            start_point = Point(float(start["lng"]), float(start["lat"]), srid=4326)
            end_point = Point(float(end["lng"]), float(end["lat"]), srid=4326)
        except (KeyError, TypeError, ValueError):
            return Response({"error": "Invalid start or end location"}, status=400)

        # [SEC-M15] cap stop count and route payload size before doing any work
        validate_booking_payload(request.data.get("stops"), request.data.get("routes"))

        # Price with the stops, same as the fare estimate (skip stops with no location)
        stops = [s for s in (request.data.get("stops") or []) if s.get("location")]

        try:
            price = calculate_price(start_point, end_point, stops)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except (KeyError, TypeError):
            return Response({"error": "Invalid stop location"}, status=400)

        data = request.data.copy()   # don't mutate request.data
        data["price"] = price

        serializer = BookingSerializer(data=data)

        if serializer.is_valid():
            booking = serializer.save(passenger=passenger)
            return Response(BookingSerializer(booking).data, status=201)

        return Response(serializer.errors, status=400)
    
class BookingDetailView(IdempotentAPIView,APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, booking_id):
        try:
            passenger = get_passenger(request.user)
            if not passenger:
                return Response({"error": "User is not a passenger"}, status=400)
            if passenger.status == "BLACKLISTED":
                return Response({"error": "User is blaclisted"}, status=400)

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

        # the driver can only pick up the passenger once they are at the pickup point
        if new_status == Booking.Status.IN_PROGRESS:
            coords = get_driver_coords(booking.id, request.data.get("location"))
            if coords is None:
                return Response({"error": "Your location is not available yet. Please try again."}, status=400)

            distance_m = distance_to_pickup_m(booking, *coords)
            if distance_m > PICKUP_RADIUS_M:
                return Response(
                    {"error": f"You are {round(distance_m)} m from the pickup point. Get within {PICKUP_RADIUS_M} m to pick up the passenger."},
                    status=400,
                )

        booking.status = new_status
        booking.save()
        if new_status == Booking.Status.IN_PROGRESS:
            log_picked_up(booking)
        elif new_status == Booking.Status.COMPLETED:
            log_completed(booking)

        return Response(BookingSerializer(booking).data)

    def delete(self, request, booking_id):
        try:
            passenger = get_passenger(request.user)
            if not passenger:
                return Response({"error": "User is not a passenger"}, status=400)
            booking = Booking.objects.get(id=booking_id, passenger=passenger)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        # [SEC-M11] keep accepted/completed bookings (history, ratings, incident evidence)
        if booking.status not in DELETABLE_BOOKING_STATUSES:
            return Response(
                {"error": "Only pending bookings can be deleted."},
                status=400,
            )

        booking.delete()
        return Response(status=204)


# The passenger cancels before being picked up:
#   pending  (still looking for a driver) -> deleted, as DELETE does
#   accepted (driver on the way)          -> status "cancelled": kept for both people's history; the
#                                            driver's app is told (signals.booking_updated) and notified
#   in_progress / completed / cancelled   -> refused
CANCEL_PICKED_UP_MESSAGE = "Your driver has already picked you up, so the ride can't be cancelled."
CANCEL_ENDED_MESSAGE = "This ride has already ended."


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def cancel_booking(request, booking_id):
    passenger = get_passenger(request.user)
    if not passenger:
        return Response({"error": "User is not a passenger"}, status=400)

    with transaction.atomic():
        # locked: a driver tapping "Pick Up Passenger" at the same moment waits, then sees "cancelled"
        booking = (
            Booking.objects.select_for_update()
            .filter(id=booking_id, passenger=passenger)
            .first()
        )
        if booking is None:
            return Response({"error": "Booking not found"}, status=404)

        if booking.status == Booking.Status.PENDING:
            booking.delete()
            return Response({"id": booking_id, "status": Booking.Status.CANCELLED}, status=200)

        if booking.status == Booking.Status.IN_PROGRESS:
            return Response({"error": CANCEL_PICKED_UP_MESSAGE}, status=400)

        if booking.status != Booking.Status.ACCEPTED:
            return Response({"error": CANCEL_ENDED_MESSAGE}, status=400)

        booking.status = Booking.Status.CANCELLED
        booking.save()
        log_cancelled_by_passenger(booking)
        transaction.on_commit(lambda: notify_booking_cancelled(booking))

    return Response(BookingSerializer(booking).data, status=200)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def driver_queue_status(request):
    driver = getattr(request.user, "driver_profile", None)

    if driver is None:
        return Response({"ready": False, "en_route": False}, status=200)

    # Active trip: accepted (going to pickup) or in progress (passenger on board)
    active_booking = (
        Booking.objects
        .filter(
            driver=driver,
            status__in=[Booking.Status.ACCEPTED, Booking.Status.IN_PROGRESS],
        )
        .order_by("-updated_at")
        .first()
    )

    trip = {
        "en_route": active_booking is not None,
        "booking_id": active_booking.id if active_booking else None,
        "booking_status": active_booking.status if active_booking else None,
    }

    entry = driver.queue.first()

    if entry is None:
        return Response(
            {
                "ready": False,
                "driver_id": driver.id,
                **trip,
            },
            status=200,
        )

    return Response(
        {
            "ready": True,
            "driver_id": driver.id,
            "location": {"lat": entry.location.y, "lng": entry.location.x},
            **trip,
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

    # [SEC-H6] drivers who registered themselves can't take rides until approved
    if driver.status == DRIVER_PENDING:
        return Response({"error": "driver is awaiting TODA admin approval"}, status=403)
    
    if not driver.verified:
        return Response({"error": "driver is not verified"}, status=403)

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

    exists = driver.queue.exists()

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

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def get_fare_price(request):
    start = request.query_params.get("start")
    end = request.query_params.get("end")
    stops = request.query_params.getlist("stops")

    if not start or not end:
        return Response({"error": "Start and end locations are required"}, status=400)

    try:
        start_coords = [float(coord) for coord in start.split(",")]
        end_coords = [float(coord) for coord in end.split(",")]
    except ValueError:
        return Response({"error": "Invalid coordinates format"}, status=400)

    if len(start_coords) != 2 or len(end_coords) != 2:
        return Response({"error": "Coordinates must be in 'lat,lng' format"}, status=400)

    start_point = Point(start_coords[1], start_coords[0])  # lng, lat
    end_point = Point(end_coords[1], end_coords[0])      # lng, lat

    if stops:
        try:
            stops = [
                {
                    "location": {
                        "lat": float(stop.split(",")[0]),
                        "lng": float(stop.split(",")[1]),
                    }
                }
                for stop in stops
            ]
        except (ValueError, IndexError):
            return Response({"error": "Invalid stop coordinates format"}, status=400)
    else:
        stops = []

    try:
        price = calculate_price(start_point, end_point, stops)
    except ValueError as e:
        return Response({"error": str(e)}, status=400)
    return Response({"price": price}, status=200)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_booking_history(request):
    if hasattr(request.user, "passenger_profile"):
        filter_kwargs = {"passenger": request.user.passenger_profile}
    elif hasattr(request.user, "driver_profile"):
        filter_kwargs = {"driver": request.user.driver_profile}
    else:
        return Response({"error": "User is neither a passenger nor a driver"}, status=400)

    bookings = (
        # history = finished rides only; active ones live on the trip screen
        Booking.objects.filter(**filter_kwargs, status__in=HISTORY_BOOKING_STATUSES)
        .select_related("driver__user", "passenger__user")
        .prefetch_related(
            "stops",
            "ratings",
            "logs",
            Prefetch("messages", queryset=Message.objects.order_by("created_at")),
        )
        .order_by("-created_at")
    )

    serializer = BookingHistorySerializer(bookings, many=True)
    return Response(serializer.data, status=200)