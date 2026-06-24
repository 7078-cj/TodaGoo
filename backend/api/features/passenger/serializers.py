from rest_framework import serializers
from django.contrib.auth.models import User
from ..user.models import Passenger
from ..user.serializers import UserSerializer
from ..utils.validation import PassengerValidationMixin

class PassengerProfileSerializer(PassengerValidationMixin, serializers.ModelSerializer):
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
        
        if not passenger_data:
            serializers.ValidationError("passenger_profile is required")

        

        if passenger_data['emergency_contact_name'] == validated_data['first_name'] or passenger_data['emergency_contact_name'] == validated_data['username']:
            serializers.ValidationError("you should not be the emergency contact name")
        

        user_serializer = UserSerializer(data=validated_data)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()

        passenger_serializer = PassengerProfileSerializer(data=passenger_data)
        passenger_serializer.is_valid(raise_exception=True)
        passenger_serializer.save(user=user)

        return user

    def update(self, instance, validated_data):
        passenger_data = validated_data.pop('passenger_profile', None)

        user_serializer = UserSerializer(instance, data=validated_data, partial=True)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()

        if passenger_data:
            passenger = instance.passenger_profile
            passenger_serializer = PassengerProfileSerializer(
                passenger, data=passenger_data, partial=True
            )
            passenger_serializer.is_valid(raise_exception=True)
            passenger_serializer.save()

        return user