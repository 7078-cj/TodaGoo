from django.db import models
from django.contrib.auth.models import User

class RegisteredToda(models.Model):
    toda_number = models.CharField(max_length=20, unique=True)
    driver_name = models.CharField(max_length=100)
    vehicle_plate = models.CharField(max_length=20)
    registration_date = models.DateTimeField()

    def __str__(self):
        return f"{self.toda_number} - {self.driver_name}"