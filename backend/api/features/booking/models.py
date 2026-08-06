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