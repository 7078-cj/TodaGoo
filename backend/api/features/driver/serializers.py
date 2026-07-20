from rest_framework import serializers
from django.contrib.auth.models import User
from ..user.models import Driver
from ..admin.models import RegisteredToda
from ..user.serializers import UserSerializer
from ..utils.validation import DriverValidationMixin


class DriverProfileSerializer(DriverValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = (
            'address',
            'contact_number',
            'profile_picture',
            'toda_number',
            'franchise_permit_number',
            'license_number',
            'vehicle_plate',
            'vehicle_front_picture',
            'vehicle_back_picture',
        )


class DriverSerializer(serializers.ModelSerializer):
    driver_profile = DriverProfileSerializer()

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'password',
            'driver_profile',
            'first_name',
            'last_name'
        )
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate(self, attrs):
        driver_data = attrs.get('driver_profile')

        if not driver_data:
            raise serializers.ValidationError("driver_profile is required")

        toda_number = driver_data.get('toda_number')
        vehicle_plate = driver_data.get('vehicle_plate')

        registered_toda = RegisteredToda.objects.filter(
            toda_number=toda_number,
            vehicle_plate=vehicle_plate
        ).select_related('toda').first()

        if not registered_toda:
            raise serializers.ValidationError(
                "TODA number and vehicle plate are not registered."
            )

        if Driver.objects.filter(vehicle_plate=vehicle_plate).exists():
            raise serializers.ValidationError(
                "This vehicle is already registered to a driver."
            )

        self._registered_toda = registered_toda

        return attrs

    def create(self, validated_data):
        driver_data = validated_data.pop('driver_profile')

        user_serializer = UserSerializer(data=validated_data)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()

        toda_station = self._registered_toda.toda

        driver_serializer = DriverProfileSerializer(data=driver_data)
        driver_serializer.is_valid(raise_exception=True)
        driver_serializer.save(
            user=user,
            status='ACTIVE',
            toda_station=toda_station
        )

        return user


    def update(self, instance, validated_data):
        driver_data = validated_data.pop('driver_profile', None)

        user_serializer = UserSerializer(instance, data=validated_data, partial=True)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()

        
        if driver_data:
            driver = instance.driver_profile
            driver_serializer = DriverProfileSerializer(
                driver, data=driver_data, partial=True
            )
            driver_serializer.is_valid(raise_exception=True)
            driver_serializer.save()

        return user