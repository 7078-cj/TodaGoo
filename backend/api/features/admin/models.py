from django.db import models
from django.contrib.auth.models import User
from django.contrib.gis.db import models as geomodels

class RegisteredToda(models.Model):
    toda_number = models.CharField(max_length=20, unique=True)
    driver_name = models.CharField(max_length=100)
    vehicle_plate = models.CharField(max_length=20)
    registration_date = models.DateTimeField()
    toda=models.ForeignKey('Toda', on_delete=models.PROTECT, related_name='drivers')

    def __str__(self):
        return f"{self.toda_number} - {self.driver_name}"
    
class Toda(models.Model):
    name = models.CharField(max_length=100)
    area = geomodels.PolygonField()
    base_fare = models.IntegerField()
    color = models.CharField(max_length=7)  
    prefix = models.CharField(max_length=2, default='00')
    created_at = models.DateTimeField(auto_now_add=True)

class TodaStation(models.Model):
    name = models.CharField(max_length=100)
    location = geomodels.PointField()
    toda = models.ForeignKey(Toda, on_delete=models.PROTECT, related_name='stations')

class BookingSettings(models.Model):
    night_fare_multiplier = models.FloatField(default=1.5)
    night_fare_start_time = models.TimeField(default='22:00:00')
    night_fare_multiplier_end_time = models.TimeField(default='05:00:00')
    is_night_fare_enabled = models.BooleanField(default=False)