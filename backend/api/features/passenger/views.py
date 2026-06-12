from django.core.cache import cache
from rest_framework.decorators import api_view, throttle_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User
from ..user.models import Passenger
from .serializers import PassengerSerializer

class PassengerListCreateView(ListCreateAPIView):
    queryset = User.objects.filter(passenger__isnull=False)
    serializer_class = PassengerSerializer


class PassengerRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    queryset = User.objects.filter(passenger__isnull=False)
    serializer_class = PassengerSerializer
    lookup_field = 'id'