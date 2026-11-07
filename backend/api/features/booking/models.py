from django.db import models
from django.contrib.auth.models import User
from django.contrib.gis.db import models as geomodels
from ..user.models import Passenger, Driver
from django.core.validators import MinValueValidator, MaxValueValidator

class DriverQueue(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="queue")
    location = geomodels.PointField()
    created_at = models.DateTimeField(auto_now_add=True)


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    TYPE_CHOICES = [
        ("regular", "REGULAR"),
        ("special", "SPECIAL")
    ]

    passenger = models.ForeignKey(Passenger, on_delete=models.CASCADE, related_name="bookings")
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="bookings", null=True, blank=True)
    start = geomodels.PointField()
    start_address = models.CharField(max_length=255)
    end = geomodels.PointField()
    end_address = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    price = models.IntegerField()
    routes = models.JSONField(null=True, blank=True)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default="regular")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Rate(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="ratings")
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    rater = models.ForeignKey(User, on_delete=models.CASCADE, related_name="ratings_given")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="ratings")
    feedback = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "booking"], name="one_rating_per_user_per_booking"
            )
        ]

class Stop(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="stops")
    address = models.CharField(max_length=255)
    point = geomodels.PointField()
    order = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["order"]

class BookingLog(models.Model):
    """
    One thing that happened to a booking, in order: requested, offered, accepted, picked up, ...
    Written by api/features/booking/logs.py log_booking_event(); shown in Ride History to the
    ride's passenger and driver. Messages never name drivers who didn't take the ride.
    Incident reports are not logged (the reported person is never told they were reported).
    """

    class Event(models.TextChoices):
        REQUESTED = "requested", "Ride requested"
        OFFERED = "offered", "Offered to a driver"
        OFFER_DECLINED = "offer_declined", "Driver declined"
        OFFER_EXPIRED = "offer_expired", "Offer expired"
        ACCEPTED = "accepted", "Driver accepted"
        DRIVER_NEARBY = "driver_nearby", "Driver near pickup"
        PICKED_UP = "picked_up", "Passenger picked up"
        COMPLETED = "completed", "Ride completed"
        CANCELLED = "cancelled", "Ride cancelled"
        RATED = "rated", "Rated"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="logs")
    event = models.CharField(max_length=30, choices=Event.choices)
    message = models.CharField(max_length=255)
    # who did it (None: the system, e.g. offers and timeouts)
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Booking #{self.booking_id}: {self.event}"
