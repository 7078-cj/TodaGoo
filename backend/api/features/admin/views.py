from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from  ...pagination import StandardPagination
from .permission import TodaAdminPermission
from .models import RegisteredToda, Toda, TodaStation, BookingSettings
from .serializers import  TodaReadSerializer, TodaWriteSerializer, RegisterWriteTodaSerializer, RegisteredReadTodaSerializer, TodaStationSerializer, BookingSettingSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import pandas as pd
from django.db import transaction
from django.template.context_processors import request
import re
from rest_framework import status
from django.db.models.deletion import ProtectedError
from ...idempotency import IdempotentAPIView
from django.utils import timezone

CACHE_TTL = 60 * 15  # 15 minutes — adjust based on how often boundaries/stations actually change

def get_booking_settings():
    settings_obj = BookingSettings.objects.first()
    if settings_obj is None:
        settings_obj = BookingSettings.objects.create()
    return settings_obj

def protected_error_response(error, what):
    summary = {}
    for obj in error.protected_objects:
        name = obj.__class__.__name__
        summary[name] = summary.get(name, 0) + 1
    related = ", ".join(f"{count} {model}" for model, count in summary.items())
    return Response(
        {
            "error": (
                f"Cannot delete this {what} because it still has related records: "
                f"{related}. Please reassign or remove those first."
            ),
            "related_objects": summary,
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


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
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError as e:
            return protected_error_response(e, "TODA boundary")
        cache.delete("toda_boundaries_list")
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        toda_number = str(data.get("toda_number") or "").strip()

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
        try:
            df = pd.read_excel(file, dtype={"toda_number": str})
        except Exception:
            return Response({"error": "Could not read the Excel file."}, status=400)

        required_cols = {"toda_number", "vehicle_plate", "driver_name",
                            "registration_date", "toda_name"}
        if not required_cols.issubset(df.columns):
            return Response({"error": f"Missing columns. Required: {required_cols}"}, status=400)

        df["toda_number"] = df["toda_number"].astype(str).str.strip()
        prefixes = df["toda_number"].str[:2].unique()
        toda_cache = {t.prefix: t for t in Toda.objects.filter(prefix__in=prefixes)}

        problems = []
        unknown = sorted(p for p in prefixes if p not in toda_cache)
        if unknown:
            problems.append(f"Unknown TODA prefix: {', '.join(unknown)}")

        repeated = df.loc[df["toda_number"].duplicated(), "toda_number"].unique().tolist()
        if repeated:
            problems.append(f"Repeated in file: {', '.join(repeated)}")

        existing = set(
            RegisteredToda.objects.filter(toda_number__in=df["toda_number"])
            .values_list("toda_number", flat=True)
        )
        if existing:
            problems.append(f"Already registered: {', '.join(sorted(existing))}")

        objects = []
        for _, row in df.iterrows():
            reg_date = pd.to_datetime(row["registration_date"], errors="coerce")
            if pd.isna(reg_date):
                problems.append(f"Invalid registration_date for {row['toda_number']}")
                continue
            reg_date = reg_date.to_pydatetime()
            if timezone.is_naive(reg_date):
                reg_date = timezone.make_aware(reg_date)
            objects.append(RegisteredToda(
                toda_number=row["toda_number"],
                vehicle_plate=row["vehicle_plate"],
                driver_name=row["driver_name"],
                registration_date=reg_date,
                toda=toda_cache.get(row["toda_number"][:2]),
            ))

        if problems:
            return Response({"error": "Upload rejected.", "details": problems}, status=400)

        with transaction.atomic():
            RegisteredToda.objects.bulk_create(objects)

        return Response({"message": f"Successfully uploaded {len(objects)} records"}, status=201)


class TODARetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, TodaAdminPermission]
    queryset = RegisteredToda.objects.all()
    serializer_class = RegisterWriteTodaSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.get("partial", False)
        instance = self.get_object()
        data = request.data.copy()
        toda = instance.toda  

        if "toda_number" in data or not partial:
            toda_number = str(data.get("toda_number") or "").strip()
            if len(toda_number) < 2:
                return Response({"error": "Invalid TODA number."}, status=400)
            toda = Toda.objects.filter(prefix=toda_number[:2]).first()
            if not toda:
                return Response({"error": "Invalid TODA prefix."}, status=400)

        serializer = self.get_serializer(instance, data=data, partial=partial)
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
    


class TodaStationListCreateView(IdempotentAPIView,ListCreateAPIView):
    queryset = TodaStation.objects.select_related('toda').all()
    serializer_class = TodaStationSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), TodaAdminPermission()]

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


class TodaStationRetrieveUpdateDestroyView(IdempotentAPIView, RetrieveUpdateDestroyAPIView):
    queryset = TodaStation.objects.select_related('toda').all()
    serializer_class = TodaStationSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), TodaAdminPermission()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError as e:
            return protected_error_response(e, "station")
        return Response(status=status.HTTP_204_NO_CONTENT)


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

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, TodaAdminPermission])
def booking_settings_view(request):
    settings_obj = get_booking_settings()

    if request.method == 'GET':
        serializer = BookingSettingSerializer(settings_obj)
        return Response(serializer.data)

    # PATCH -> partial update
    serializer = BookingSettingSerializer(
        settings_obj,
        data=request.data,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_200_OK)