from django.contrib.gis.geos import Point
from rest_framework import serializers
from .models import Booking, Stop, DriverQueue, Rate, User
from ..driver.serializers import DriverReadSerializer
from ..passenger.serializers import PassengerReadSerializer
from rest_framework.exceptions import PermissionDenied


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


class RateSerializer(serializers.ModelSerializer):
    """Read-only serializer, used for listing/returning ratings (e.g. GET feedback)."""

    rater_id = serializers.IntegerField(read_only=True)
    rated_user_id = serializers.IntegerField(source="user_id", read_only=True)
    rated_role = serializers.SerializerMethodField()

    class Meta:
        model = Rate
        fields = [
            "id",
            "booking",
            "rater_id",
            "rated_user_id",
            "rated_role",
            "score",
            "feedback",
            "created_at",
        ]
        read_only_fields = fields

    def get_rated_role(self, obj):
        driver_user_id = getattr(obj.booking.driver, "user_id", None)
        return "driver" if obj.user_id == driver_user_id else "passenger"


class BookingSerializer(serializers.ModelSerializer):
    start = PointField()
    end = PointField()
    stops = StopSerializer(many=True)
    driver = DriverReadSerializer(read_only=True)
    passenger = PassengerReadSerializer(read_only=True)
    ratings = RateSerializer(many=True, read_only=True)
    routes = serializers.JSONField(required=False, allow_null=True)

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
            "ratings",
            "routes"
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


class RateCreateSerializer(serializers.Serializer):
    """Write serializer: validates + creates a Rate. Requires `request` in context."""

    booking_id = serializers.IntegerField()
    user_id = serializers.IntegerField()
    score = serializers.IntegerField(min_value=1, max_value=5)
    feedback = serializers.CharField(
        max_length=500, required=False, allow_blank=True, allow_null=True
    )

    def validate(self, attrs):
        request = self.context["request"]

        booking = (
            Booking.objects.select_related(
                "driver", "driver__user", "passenger", "passenger__user"
            )
            .filter(id=attrs["booking_id"])
            .first()
        )
        if booking is None:
            raise serializers.ValidationError({"booking_id": "Booking not found"})

        driver_user_id = getattr(booking.driver, "user_id", None)
        passenger_user_id = getattr(booking.passenger, "user_id", None)
        rated_user_id = attrs["user_id"]

        if rated_user_id == driver_user_id:
            rated_role = "driver"
        elif rated_user_id == passenger_user_id:
            rated_role = "passenger"
        else:
            raise serializers.ValidationError(
                {"user_id": "user_id is not a participant in this booking"}
            )

        if request.user.id == rated_user_id:
            raise serializers.ValidationError({"user_id": "You cannot rate yourself"})

        if request.user.id not in (driver_user_id, passenger_user_id):
            raise PermissionDenied("You are not a participant in this booking")

        if Rate.objects.filter(rater=request.user, booking=booking).exists():
            raise serializers.ValidationError(
                "You have already rated this booking"
            )

        try:
            rated_user = User.objects.get(id=rated_user_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({"user_id": "User not found"})

        attrs["booking"] = booking
        attrs["rated_user"] = rated_user
        attrs["rated_role"] = rated_role
        return attrs

    def create(self, validated_data):
        request = self.context["request"]

        rate = Rate.objects.create(
            user=validated_data["rated_user"],
            rater=request.user,
            booking=validated_data["booking"],
            score=validated_data["score"],
            feedback=validated_data.get("feedback"),
        )
        rate.rated_role = validated_data["rated_role"]
        return rate