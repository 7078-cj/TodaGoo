from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

class Admin(models.Model):
    department_choices = [
        ('TODA', 'Toda'),
        ('MDRRMO', 'MDRRMO'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    department = models.CharField(max_length=100, choices=department_choices)


    def __str__(self):
        return self.user.username
    