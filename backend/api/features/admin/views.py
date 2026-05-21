from django.core.cache import cache
from rest_framework.decorators import api_view, throttle_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ...permissions import TodaAdminPermission
from .models import RegisteredToda, Toda
from .serializers import RegisteredTodaSerializer, TodaReadSerializer, TodaWriteSerializer
from rest_framework.parsers import MultiPartParser, FormParser
import pandas as pd

class TodaStationListCreateAPIView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = Toda.objects.all()
    
    def get_serializer_class(self):
        if self.action in ['create']:
            return TodaWriteSerializer
        return TodaReadSerializer
    
class TodaStationRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = Toda.objects.all()
    
    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return TodaWriteSerializer
        return TodaReadSerializer
    
    

class TODAListCreateAPIView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = RegisteredToda.objects.all()
    serializer_class = RegisteredTodaSerializer
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        toda_number = self.request.query_params.get('toda_number')
        if toda_number:
            queryset = queryset.filter(toda_number__icontains=toda_number)
            
        driver_name = self.request.query_params.get('driver_name')
        if driver_name:
            queryset = queryset.filter(driver_name__icontains=driver_name)
            
        vehicle_plate = self.request.query_params.get('vehicle_plate')
        if vehicle_plate:
            queryset = queryset.filter(vehicle_plate__icontains=vehicle_plate)
            
        registration_date = self.request.query_params.get('registration_date')
        if registration_date:
            queryset = queryset.filter(registration_date__date=registration_date)
            
        return queryset
    
    def perform_create(self, serializer):
        file = self.request.FILES.get('file')
        if file:
            df = pd.read_excel(file)
            objects = []
            for _, row in df.iterrows():
                toda = Toda.objects.filter(toda_name=row['toda_name']).first()
                
                obj = RegisteredToda(
                    toda_number=row['toda_number'],
                    vehicle_plate=row['vehicle_plate'],
                    driver_name=row['driver_name'],
                    registration_date=row['registration_date'],
                    toda=toda
                )
                objects.append(obj)
                
            RegisteredToda.objects.bulk_create(objects)
        else:
            serializer.save()