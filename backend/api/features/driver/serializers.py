from rest_framework import serializers
from django.contrib.auth.models import User
from ..user.models import Driver
from ..admin.models import RegisteredToda, TodaStation
from ..user.serializers import UserSerializer

from ..utils.validation import DriverValidationMixin
from django.db import transaction, IntegrityError


class DriverProfileSerializer(DriverValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = (
            'address',
            'contact_number',
            'profile_picture',
            'toda_number',
            'vehicle_plate',
            'vehicle_front_picture',
            'vehicle_back_picture',
            "status"
        )


class DriverSerializer(serializers.ModelSerializer):
    driver_profile = DriverProfileSerializer()
    toda_station_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'password',
            'driver_profile',
            'first_name',
            'last_name',
            'toda_station_id',
        )
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate(self, attrs):
        driver_data = attrs.get('driver_profile')

        if not driver_data:
            if self.instance is None:
                raise serializers.ValidationError("driver_profile is required")
            return attrs

        is_update = self.instance is not None
        changing_registration = 'toda_number' in driver_data or 'vehicle_plate' in driver_data

        self._toda_station = None
        self._registered_toda = None

        if not is_update or changing_registration:
            if is_update:
                current = self.instance.driver_profile
                toda_number = driver_data.get('toda_number', current.toda_number)
                vehicle_plate = driver_data.get('vehicle_plate', current.vehicle_plate)
            else:
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

            plate_qs = Driver.objects.filter(vehicle_plate=vehicle_plate)
            if self.instance is not None:
                plate_qs = plate_qs.exclude(pk=self.instance.driver_profile.pk)

            if plate_qs.exists():
                raise serializers.ValidationError(
                    "This vehicle is already registered to a driver."
                )

            self._registered_toda = registered_toda

        toda_station_id = attrs.get('toda_station_id')
        if toda_station_id:
            toda_station = TodaStation.objects.filter(id=toda_station_id).first()
            if toda_station is None:
                raise serializers.ValidationError(
                    {"toda_station_id": "Toda Station not found."}
                )
            self._toda_station = toda_station

        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                driver_data = validated_data.pop('driver_profile')
                validated_data.pop('toda_station_id', None)
                user_serializer = UserSerializer(data=validated_data)
                user_serializer.is_valid(raise_exception=True)
                user = user_serializer.save()

                toda_boundary = self._registered_toda.toda

                driver_serializer = DriverProfileSerializer(data=driver_data)
                driver_serializer.is_valid(raise_exception=True)
                driver_serializer.save(
                    user=user,
                    status='ACTIVE',
                    toda_boundary=toda_boundary,
                    toda_station=self._toda_station
                )
        except IntegrityError:
            raise serializers.ValidationError(
                {"driver_profile": {"vehicle_plate": "This vehicle is already registered to a driver."}}
            )

        return user


    def update(self, instance, validated_data):
        with transaction.atomic():
            driver_data = validated_data.pop('driver_profile', None)
            validated_data.pop('toda_station_id', None)

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

            if self._toda_station is not None:
                driver = instance.driver_profile
                driver.toda_station = self._toda_station
                driver.save(update_fields=['toda_station'])

        return user

class DriverReadSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = Driver
        fields = (
            'id',
            'username',
            'first_name',
            'last_name',
            'contact_number',
            'toda_number',
            'vehicle_plate',
            'profile_picture',
            'vehicle_front_picture',
            'vehicle_back_picture',
            'rating'
        )