from rest_framework import serializers
from django.contrib.auth.models import User
from ..user.models import Passenger


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


class PassengerSerializer(serializers.ModelSerializer):
    passenger_profile = PassengerProfileSerializer(write_only=True)

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
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


        instance.save()

        if passenger_data:
            passenger = instance.passenger_profile
            for attr, value in passenger_data.items():
                setattr(passenger, attr, value)
            passenger.save()

        return instance