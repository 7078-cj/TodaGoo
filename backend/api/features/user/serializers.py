from rest_framework import serializers
from django.contrib.auth.models import User

from .models import Notification
from ..utils.validation import UserValidationMixin

class UserSerializer(UserValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'password', 'first_name', 'last_name',)
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name']
        )

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        instance.username = validated_data.get('username', instance.username)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)

        if password:
            instance.set_password(password)

        instance.save()
        return instance

class NotificationSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(read_only=True)
    # lets the app skip redirects to rides that have already ended
    booking_status = serializers.CharField(source='booking.status', read_only=True, default=None)

    class Meta:
        model = Notification
        fields = ('id', 'user', 'type', 'booking_id', 'booking_status', 'message', 'created_at', 'read')