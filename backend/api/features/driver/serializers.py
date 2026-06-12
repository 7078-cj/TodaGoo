from rest_framework import serializers
from django.contrib.auth.models import User
from ..user.models import Driver
from ..admin.models import RegisteredToda


class DriverProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = (
            'address',
            'profile_picture',
            'toda_number',
            'franchise_permit_number',
            'license_number',
            'vehicle_plate',
            'vehicle_front_picture',
            'vehicle_back_picture',
        )


class DriverSerializer(serializers.ModelSerializer):
    driver_profile = DriverProfileSerializer(write_only=True)

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'password',
            'driver_profile'
        )
        extra_kwargs = {
            'password': {'write_only': True}
        }

    # =========================
    # VALIDATION LOGIC
    # =========================
    def validate(self, attrs):
        driver_data = attrs.get('driver_profile')

        toda_number = driver_data.get('toda_number')
        vehicle_plate = driver_data.get('vehicle_plate')

        if not RegisteredToda.objects.filter(
            toda_number=toda_number,
            vehicle_plate=vehicle_plate
        ).exists():
            raise serializers.ValidationError(
                "TODA number and vehicle plate are not registered."
            )

        # Optional: prevent duplicate vehicle registration
        if Driver.objects.filter(vehicle_plate=vehicle_plate).exists():
            raise serializers.ValidationError(
                "This vehicle is already registered to a driver."
            )

        return attrs

    # =========================
    # CREATE DRIVER + USER
    # =========================
    def create(self, validated_data):
        driver_data = validated_data.pop('driver_profile')

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )

        Driver.objects.create(
            user=user,
            status='PENDING',  
            **driver_data
        )

        return user

    # =========================
    # UPDATE DRIVER + USER
    # =========================
    def update(self, instance, validated_data):
        driver_data = validated_data.pop('driver_profile', None)

        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)

        if 'password' in validated_data:
            instance.set_password(validated_data['password'])

        instance.save()

        if driver_data:
            driver = instance.driver
            for attr, value in driver_data.items():
                setattr(driver, attr, value)
            driver.save()

        return instance