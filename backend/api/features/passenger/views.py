from django.core.cache import cache
from rest_framework.decorators import api_view, throttle_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User
from ..user.models import Passenger
from .serializers import PassengerSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..utils.reconstruction import reconstruct_nested
from rest_framework.response import Response
from rest_framework import status
from .permissions import IsPassengerOwnerOrAdmin


class PassengerListCreateView(ListCreateAPIView):
    queryset = User.objects.filter(passenger_profile__isnull=False)
    serializer_class = PassengerSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [AllowAny()]
        return [IsPassengerOwnerOrAdmin(), IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        data = reconstruct_nested(request.data, prefix="passenger_profile.")

        serializer = self.get_serializer(data=data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        self.perform_create(serializer)

        cache.delete(f"passenger_profile:{serializer.instance.id}")

        return Response(serializer.data, status=201)


class PassengerRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    queryset = User.objects.filter(passenger_profile__isnull=False).select_related('passenger_profile')
    serializer_class = PassengerSerializer
    lookup_field = 'pk'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsPassengerOwnerOrAdmin(), IsAuthenticated()]

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        cache_key = f"passenger_profile:{pk}"

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().retrieve(request, *args, **kwargs)
        cache.set(cache_key, response.data, 60 * 30)
        return response

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = reconstruct_nested(request.data, prefix="passenger_profile.")
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        cache.delete(f"passenger_profile:{instance.pk}")

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        pk = instance.pk
        response = super().destroy(request, *args, **kwargs)
        cache.delete(f"passenger_profile:{pk}")
        return response