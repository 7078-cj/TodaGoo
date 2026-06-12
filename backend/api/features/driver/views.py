from django.core.cache import cache
from rest_framework.decorators import api_view, throttle_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User
from ..user.models import Driver
from .serializers import DriverSerializer
from .permissions import IsDriverOwnerOrAdmin

class DriverListCreateView(ListCreateAPIView):
    queryset = User.objects.filter(driver__isnull=False)
    serializer_class = DriverSerializer


class DriverRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    queryset = User.objects.filter(driver__isnull=False)
    serializer_class = DriverSerializer
    permission_classes = [IsDriverOwnerOrAdmin]
    lookup_field = 'pk'