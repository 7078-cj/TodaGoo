from django.core.cache import cache
from rest_framework.decorators import api_view, throttle_classes
from rest_framework import viewsets, permissions
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from django.contrib.auth.models import User
from ..user.models import Driver
from .serializers import DriverSerializer
from .permissions import IsDriverOwnerOrAdmin
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..utils.reconstruction import reconstruct_nested
from rest_framework.response import Response
from rest_framework import status
from .utils import verify_license_details


class DriverListCreateView(ListCreateAPIView):
    queryset = User.objects.filter(driver_profile__isnull=False)
    serializer_class = DriverSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsDriverOwnerOrAdmin(), IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        print("\n========== DRIVER REGISTRATION ==========")

        print("Raw request.data:")
        print(request.data)

        data = reconstruct_nested(request.data, prefix="driver_profile.")

        print("\nReconstructed data:")
        print(data)

        license_image = request.data.get("driver_profile.license_id")
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        license_number = data.get("driver_profile", {}).get("license_number")

        print("\nExtracted fields:")
        print(f"First Name     : {first_name}")
        print(f"Last Name      : {last_name}")
        print(f"License Number : {license_number}")
        print(f"License Image  : {license_image}")

        if license_image:
            print("\nRunning OCR verification...")

            ocr_result = verify_license_details(
                license_image,
                first_name,
                last_name,
                license_number,
            )

            print("OCR Result:")
            print(ocr_result)

            if not ocr_result["match"]:
                print("❌ OCR verification failed.")

                return Response(
                    {
                        "detail": "License details could not be verified against the uploaded document.",
                        "matched_fields": ocr_result["matched_fields"],
                    },
                    status=400,
                )

            print("✅ OCR verification passed.")

        else:
            print("❌ No license image uploaded.")

            return Response(
                {
                    "detail": "License details could not be verified against the uploaded document.",
                },
                status=400,
            )

        serializer = self.get_serializer(data=data)

        print("\nValidating serializer...")

        if not serializer.is_valid():
            print("❌ Serializer errors:")
            print(serializer.errors)

            return Response(serializer.errors, status=400)

        print("✅ Serializer valid.")

        self.perform_create(serializer)

        print("✅ Driver successfully created.")
        print("=========================================\n")

        return Response(serializer.data, status=201)


class DriverRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    queryset = User.objects.filter(driver_profile__isnull=False)
    serializer_class = DriverSerializer
    lookup_field = 'pk'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsDriverOwnerOrAdmin(), IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = reconstruct_nested(request.data, prefix="driver_profile.")
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)