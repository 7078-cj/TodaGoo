from rest_framework import serializers
from .models import RegisteredToda, Toda
from django.contrib.gis.geos import Polygon


        
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
    area = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = Toda
        fields = '__all__'

    def validate_area(self, value):
        if value is None:
            return value
        try:
            # [[[lng, lat], ...]]
            polygon = Polygon(value[0])
            return polygon
        except (TypeError, IndexError, ValueError) as e:
            raise serializers.ValidationError(
                f"Invalid polygon coordinates: {e}"
            )

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