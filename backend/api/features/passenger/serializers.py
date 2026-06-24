from rest_framework import serializers
from django.contrib.auth.models import User
from ..user.models import Passenger
from ..utils.validation import UserValidationMixin

class PassengerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Passenger
        fields = (
            'address',
            'profile_picture',
            'contact_number',
            'emergency_contact_name',
            'emergency_contact_number',
        )


class PassengerSerializer(UserValidationMixin,serializers.ModelSerializer):
    passenger_profile = PassengerProfileSerializer()

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'password',
            'passenger_profile',
        )
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):

        passenger_data = validated_data.pop('passenger_profile')

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
        )

        Passenger.objects.create(
            user=user,
            **passenger_data
        )

        return user
    
    def update(self, instance, validated_data):
        passenger_data = validated_data.pop('passenger_profile', None)

        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)

        instance.save()

        if passenger_data:
            passenger = instance.passenger_profile
            for attr, value in passenger_data.items():
                setattr(passenger, attr, value)
            passenger.save()

        return instance