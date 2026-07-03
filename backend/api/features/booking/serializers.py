from django.contrib.gis.geos import Point
from rest_framework import serializers
from .models import Booking, Stop, DriverQueue


class StopSerializer(serializers.ModelSerializer):
    location = serializers.DictField(write_only=True)

    class Meta:
        model = Stop
        fields = [
            "id",
            "address",
            "point",
            "location",
            "order",
        ]
        read_only_fields = ["point"]

    def create(self, validated_data):
        location = validated_data.pop("location")

        validated_data["point"] = Point(
            location["lng"],  # longitude
            location["lat"],  # latitude
        )

        return Stop.objects.create(**validated_data)


class BookingSerializer(serializers.ModelSerializer):
    start = serializers.DictField(write_only=True)
    end = serializers.DictField(write_only=True)
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
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        start = validated_data.pop("start")
        end = validated_data.pop("end")
        stops_data = validated_data.pop("stops", [])

        validated_data["start"] = Point(
            start["lng"],
            start["lat"],
        )

        validated_data["end"] = Point(
            end["lng"],
            end["lat"],
        )

        booking = Booking.objects.create(**validated_data)

        serializer = StopSerializer(data=stops_data, many=True)
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