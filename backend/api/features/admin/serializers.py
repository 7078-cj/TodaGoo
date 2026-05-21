from rest_framework import serializers
from .models import RegisteredToda

class RegisteredTodaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegisteredToda
        fields = '__all__'