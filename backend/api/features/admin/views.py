from django.core.cache import cache
from rest_framework.decorators import api_view, throttle_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from  ...pagination import StandardPagination
from ...permissions import TodaAdminPermission
from .models import RegisteredToda, Toda, TodaStation
from .serializers import  TodaReadSerializer, TodaWriteSerializer, RegisterWriteTodaSerializer, RegisteredReadTodaSerializer, TodaStationSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import pandas as pd
from django.db import transaction
from django.template.context_processors import request
import re
from rest_framework import status


class TodaStationListCreateAPIView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = Toda.objects.all()
    
    def get_serializer_class(self):
        if self.request.method == "POST":
            return TodaWriteSerializer
        return TodaReadSerializer


class TodaStationRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = Toda.objects.all()
    
    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return TodaWriteSerializer
        return TodaReadSerializer
    

class TODAListCreateAPIView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = RegisteredToda.objects.all().select_related('toda')
    serializer_class = RegisteredReadTodaSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()

        filters = {
            "toda_number__icontains": self.request.query_params.get("toda_number"),
            "driver_name__icontains": self.request.query_params.get("driver_name"),
            "vehicle_plate__icontains": self.request.query_params.get("vehicle_plate"),
            "toda__name__icontains": self.request.query_params.get("toda_boundary"),
        }

        for k, v in filters.items():
            if v:
                queryset = queryset.filter(**{k: v})

        registration_date = self.request.query_params.get("registration_date")
        if registration_date:
            queryset = queryset.filter(registration_date__date=registration_date)

        return queryset

    def create(self, request, *args, **kwargs):
        file = request.FILES.get("file")

        if file:
            return self._handle_excel_upload(file)

        return self._handle_single_create(request)



    def _handle_single_create(self, request):
        data = request.data.copy()
        toda_number = data.get("toda_number", "").strip()

        if len(toda_number) < 2:
            return Response(
                {"error": "Invalid TODA number."},
                status=400,
            )

        prefix = toda_number[:2]

        if not re.fullmatch(r"\d{2}", prefix):
            return Response(
                {"error": "TODA prefix must be numeric."},
                status=400,
            )

        toda = Toda.objects.filter(prefix=prefix).first()
        if not toda:
            return Response(
                {"error": "Invalid TODA prefix."},
                status=400,
            )

        serializer = RegisteredReadTodaSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(toda=toda)

        return Response(serializer.data, status=201)

    def _handle_excel_upload(self, file):
        df = pd.read_excel(file)

        required_cols = {
            "toda_number",
            "vehicle_plate",
            "driver_name",
            "registration_date",
            "toda_name"
        }

        if not required_cols.issubset(df.columns):
            return Response(
                {"error": f"Missing columns. Required: {required_cols}"},
                status=400
            )

        prefixes = df["toda_number"].str[:2].unique()

        toda_cache = {
            t.prefix: t
            for t in Toda.objects.filter(prefix__in=prefixes)
        }

        objects = []

        with transaction.atomic():
            for _, row in df.iterrows():
                prefix = str(row["toda_number"])[:2]
                toda = toda_cache.get(prefix)

                objects.append(
                    RegisteredToda(
                        toda_number=row["toda_number"],
                        vehicle_plate=row["vehicle_plate"],
                        driver_name=row["driver_name"],
                        registration_date=row["registration_date"],
                        toda=toda,
                    )
                )

            RegisteredToda.objects.bulk_create(objects)

        return Response(
            {"message": f"Successfully uploaded {len(objects)} records"},
            status=201
        )

class TODARetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = RegisteredToda.objects.all()
    serializer_class = RegisterWriteTodaSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data.copy()

        toda_number = data.get("toda_number", "").strip()

        if len(toda_number) < 2:
            return Response(
                {"error": "Invalid TODA number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prefix = toda_number[:2]

        toda = Toda.objects.filter(prefix=prefix).first()
        if not toda:
            return Response(
                {"error": "Invalid TODA prefix."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(
            instance,
            data=data,
            partial=kwargs.get("partial", False),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(toda=toda)

        return Response(serializer.data)



class TodaStationListCreateView(ListCreateAPIView):
    queryset = TodaStation.objects.select_related('toda').all()
    serializer_class = TodaStationSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        toda_id = self.request.query_params.get('toda_id')
        if toda_id:
            queryset = queryset.filter(toda_id=toda_id)
        return queryset


class TodaStationRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    queryset = TodaStation.objects.select_related('toda').all()
    serializer_class = TodaStationSerializer
    permission_classes = [permissions.IsAuthenticated]
        