from django.contrib.gis.geos import Point
from rest_framework import serializers
from .models import Booking, Stop, DriverQueue


class PointField(serializers.Field):
    """
    Converts between:
    Request:
    {
        "lat": 14.949,
        "lng": 120.757
    }

    Database:
    Point(120.757, 14.949)

    Response:
    {
        "lat": 14.949,
        "lng": 120.757
    }
    """

    def to_representation(self, value):
        if value is None:
            return None

        return {
            "lat": value.y,
            "lng": value.x,
        }

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError(
                "Location must be an object containing lat and lng."
            )

        try:
            lat = float(data["lat"])
            lng = float(data["lng"])
        except KeyError:
            raise serializers.ValidationError(
                "Both lat and lng are required."
            )
        except (TypeError, ValueError):
            raise serializers.ValidationError(
                "lat and lng must be numbers."
            )

        return Point(lng, lat)


class StopSerializer(serializers.ModelSerializer):
    location = PointField(source="point")

    class Meta:
        model = Stop
        fields = [
            "id",
            "address",
            "location",
            "order",
        ]


class BookingSerializer(serializers.ModelSerializer):
    start = PointField()
    end = PointField()
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
        stops_data = validated_data.pop("stops", [])

        booking = Booking.objects.create(**validated_data)

        for stop_data in stops_data:
            Stop.objects.create(
                booking=booking,
                **stop_data,
            )

        return booking

    def update(self, instance, validated_data):
        stops_data = validated_data.pop("stops", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if stops_data is not None:
            instance.stops.all().delete()

            for stop_data in stops_data:
                Stop.objects.create(
                    booking=instance,
                    **stop_data,
                )

        return instance


class DriverQueueSerializer(serializers.ModelSerializer):
    location = PointField()

    class Meta:
        model = DriverQueue
        fields = [
            "id",
            "driver",
            "location",
        ]
