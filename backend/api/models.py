
from django.db import models
from .user.models import *
from django.contrib.auth.models import User
#import the models here in nested folder to migrate

class Admin(models.Model):
    department_choices = [
        ('TODA', 'Toda'),
        ('MDRRMO', 'MDRRMO'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    department = models.CharField(max_length=100, choices=department_choices)


    def __str__(self):
        return self.user.username
