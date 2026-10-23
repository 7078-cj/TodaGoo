from rest_framework import serializers
from .models import RegisteredToda, Toda, TodaStation, BookingSettings
from django.contrib.gis.geos import Polygon
from ..booking.serializers import PointField

        
class TodaReadSerializer(serializers.ModelSerializer):
    area = serializers.SerializerMethodField()
    
    class Meta:
        model = Toda
        fields = '__all__'
        
    def get_area(self, obj):
        if obj.area:
            return obj.area.coords 
        return None
    
class TodaWriteSerializer(serializers.ModelSerializer):
    area = serializers.JSONField(required=True, allow_null=False)

    class Meta:
        model = Toda
        fields = '__all__'

    def validate_area(self, value):
        if value is None:
            return value
        try:
            ring = value

            
            if ring[0] == ring[-1]:
                ring = ring[:-1]

            # close it cleanly once
            ring = ring + [ring[0]]

            if len(ring) < 4:
                raise serializers.ValidationError(
                    f"LinearRing requires at least 4 points, got {len(ring)}."
                )
            return Polygon(ring)
        except (TypeError, IndexError, ValueError) as e:
            raise serializers.ValidationError(f"Invalid polygon coordinates: {e}")

    def to_representation(self, instance):
        return TodaReadSerializer(instance, context=self.context).data

    def create(self, validated_data):
        return Toda.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
    
class RegisteredReadTodaSerializer(serializers.ModelSerializer):
    toda_name = serializers.CharField(source='toda.name', read_only=True)
    class Meta:
        model = RegisteredToda
        fields = '__all__'
        read_only_fields = ['toda', 'toda_name']

class RegisterWriteTodaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegisteredToda
        fields = '__all__'
        read_only_fields = ['toda', 'toda_name']

class TodaStationSerializer(serializers.ModelSerializer):
    location = PointField()

    def create(self, validated_data):
        point = validated_data.pop('location') 
        toda = Toda.objects.filter(area__contains=point).first()

        if not toda:
            raise serializers.ValidationError(
                {"location": "This location is outside all TODA jurisdictions."}
            )

        toda_station = TodaStation.objects.create(toda=toda, location=point, **validated_data)
        return toda_station

    def update(self, instance, validated_data):
        point = validated_data.get("location")
        if point is not None:
            toda = Toda.objects.filter(area__contains=point).first()
            if not toda:
                raise serializers.ValidationError(
                    {"location": "This location is outside all TODA jurisdictions."}
                )
            validated_data["toda"] = toda
        return super().update(instance, validated_data)

    class Meta:
        model = TodaStation
        fields = '__all__'
        read_only_fields = ['toda']



class BookingSettingSerializer(serializers.ModelSerializer):

    class Meta:
        model = BookingSettings
        fields = '__all__'

    def validate_night_fare_multiplier(self, value):
        if value < 1:
            raise serializers.ValidationError("Multiplier must be at least 1.0.")
        return value

    def validate(self, attrs):
        # On partial updates, fall back to the current instance values
        start = attrs.get(
            'night_fare_start_time',
            getattr(self.instance, 'night_fare_start_time', None),
        )
        end = attrs.get(
            'night_fare_multiplier_end_time',
            getattr(self.instance, 'night_fare_multiplier_end_time', None),
        )
        if start and end and start == end:
            raise serializers.ValidationError(
                "Night fare start time and end time cannot be the same."
            )
        return attrs