from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from ..admin.models import Toda,TodaStation

class Admin(models.Model):
    department_choices = [
        ('TODA', 'Toda'),
        ('MDRRMO', 'MDRRMO'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    department = models.CharField(max_length=100, choices=department_choices)


    def __str__(self):
        return self.user.username
    
class Driver(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('SUSPENDED', 'Suspended'),
        ('BLACKLISTED', 'Blacklisted'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='ACTIVE')
    address= models.CharField(max_length=255)
    contact_number = models.CharField(max_length=11)
    toda_boundary = models.ForeignKey(Toda, on_delete=models.CASCADE, related_name='toda_drivers', null=True, blank=True)
    toda_station = models.ForeignKey(TodaStation, on_delete=models.CASCADE, related_name='toda_station_drivers', null=True, blank=True)
    profile_picture = models.ImageField(upload_to='driver_profiles/', null=True, blank=True)
    toda_number = models.CharField(max_length=20)
    vehicle_plate = models.CharField(max_length=20, unique=True)
    vehicle_front_picture = models.ImageField(upload_to='vehicle_fronts/', null=True, blank=True)
    vehicle_back_picture = models.ImageField(upload_to='vehicle_backs/', null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)

    def __str__(self):
        return self.user.username

class Passenger(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="passenger_profile")
    address = models.CharField(max_length=255)
    profile_picture = models.ImageField(upload_to='passenger_profiles/', null=True, blank=True)
    contact_number = models.CharField(max_length=11)
    emergency_contact_name = models.CharField(max_length=100)
    emergency_contact_number = models.CharField(max_length=11)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)

    def __str__(self):
        return self.user.username
    