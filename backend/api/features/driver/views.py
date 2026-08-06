from django.core.cache import cache
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User
from .serializers import DriverSerializer
from .permissions import IsDriverOwnerOrAdmin
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..utils.reconstruction import reconstruct_nested
from rest_framework.response import Response



class DriverListCreateView(ListCreateAPIView):
    queryset =queryset = User.objects.filter(driver_profile__isnull=False).select_related('driver_profile')
    serializer_class = DriverSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsDriverOwnerOrAdmin(), IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        data = reconstruct_nested(request.data, prefix="driver_profile.")
        serializer = self.get_serializer(data=data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        self.perform_create(serializer)

        cache.delete(f"driver_profile:{serializer.instance.id}")

        return Response(serializer.data, status=201)


class DriverRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    queryset = User.objects.filter(driver_profile__isnull=False).select_related('driver_profile')
    serializer_class = DriverSerializer
    lookup_field = 'pk'
    permission_classes = [IsDriverOwnerOrAdmin(), IsAuthenticated()]

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        cache_key = f"driver_profile:{pk}"

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().retrieve(request, *args, **kwargs)
        cache.set(cache_key, response.data, 60 * 30)
        return response

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = reconstruct_nested(request.data, prefix="driver_profile.")
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        cache.delete(f"driver_profile:{instance.pk}")

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        pk = instance.pk
        response = super().destroy(request, *args, **kwargs)
        cache.delete(f"driver_profile:{pk}")
        return response