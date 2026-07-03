from rest_framework import serializers
from .models import Booking, Stop, DriverQueue


class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = [
            "id",
            "address",
            "point",
            "order",
        ]

    def create(self, validated_data):
        return Stop.objects.create(**validated_data)


class BookingSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "passenger",
            "driver",
            "start",
            "start_address",
            "end",
            "end_address",
            "status",
            "price",
            "created_at",
            "updated_at",
            "stops",
        ]
        read_only_fields = [
            "id",
            "passenger",
            "driver",
            "status",
            "price",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        stops_data = validated_data.pop("stops", [])

        booking = Booking.objects.create(**validated_data)

        serializer = StopSerializer(
            data=stops_data,
            many=True,
            context=self.context,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(booking=booking)

        return booking


class DriverQueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverQueue
        fields = [
            "id",
            "driver",
            "location",
        ]