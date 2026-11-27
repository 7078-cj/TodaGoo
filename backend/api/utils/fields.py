from django.contrib.gis.geos import Point
from rest_framework import serializers


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
