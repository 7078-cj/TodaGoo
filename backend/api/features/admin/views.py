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
from django.db.models.deletion import ProtectedError

CACHE_TTL = 60 * 15  # 15 minutes — adjust based on how often boundaries/stations actually change


class TodaBoundariesListCreateAPIView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = Toda.objects.all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TodaWriteSerializer
        return TodaReadSerializer

    def list(self, request, *args, **kwargs):
        cache_key = "toda_boundaries_list"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, list(response.data), CACHE_TTL)
        return response

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        cache.delete("toda_boundaries_list")
        return response


class TodaBoundariesRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = Toda.objects.all()

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return TodaWriteSerializer
        return TodaReadSerializer

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        cache.delete("toda_boundaries_list")
        return response

    def destroy(self, request, *args, **kwargs):
        response = super().destroy(request, *args, **kwargs)
        cache.delete("toda_boundaries_list")
        return response


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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        try:
            instance.delete()
        except ProtectedError as e:
            related_summary = {}
            for obj in e.protected_objects:
                model_name = obj.__class__.__name__
                related_summary.setdefault(model_name, 0)
                related_summary[model_name] += 1

            related_list = ", ".join(
                f"{count} {model}" for model, count in related_summary.items()
            )

            return Response(
                {
                    "error": (
                        f"Cannot delete this TODA registration because it still has "
                        f"related records: {related_list}. Please reassign or remove "
                        f"those first."
                    ),
                    "related_objects": related_summary,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


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

    def list(self, request, *args, **kwargs):
        toda_id = request.query_params.get('toda_id') or "all"
        cache_key = f"toda_stations_list:{toda_id}"

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, list(response.data), CACHE_TTL)
        return response


class TodaStationRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    queryset = TodaStation.objects.select_related('toda').all()
    serializer_class = TodaStationSerializer
    permission_classes = [permissions.IsAuthenticated]


@api_view(['GET'])
def get_toda_stations_with_prefix(request):
    prefix = request.query_params.get('prefix')
    if not prefix:
        return Response({"error": "prefix query parameter is required."}, status=400)

    cache_key = f"toda_stations_prefix:{prefix}"
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    toda = Toda.objects.filter(prefix=prefix).first()
    if not toda:
        return Response({"error": "Invalid TODA prefix."}, status=400)

    stations = TodaStation.objects.filter(toda=toda)
    serializer = TodaStationSerializer(stations, many=True)

    cache.set(cache_key, serializer.data, CACHE_TTL)
    return Response(serializer.data)