from django.db import models
from django.contrib.auth.models import User
from django.contrib.gis.db import models as geomodels

class RegisteredToda(models.Model):
    toda_number = models.CharField(max_length=20, unique=True)
    driver_name = models.CharField(max_length=100)
    vehicle_plate = models.CharField(max_length=20)
    registration_date = models.DateTimeField()
    toda=models.ForeignKey('Toda', on_delete=models.CASCADE, related_name='drivers')

    def __str__(self):
        return f"{self.toda_number} - {self.driver_name}"
    
class Toda(models.Model):
    name = models.CharField(max_length=100)
    area = geomodels.PolygonField()
    color = models.CharField(max_length=7)  
    prefix = models.CharField(max_length=2, default=00)
    created_at = models.DateTimeField(auto_now_add=True)

class TodaStation(models.Model):
    name = models.CharField(max_length=100)
    location = geomodels.PointField()
    toda = models.ForeignKey(Toda, on_delete=models.CASCADE, related_name='stations')