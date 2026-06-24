# mixins.py
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers


class UserValidationMixin:
    """
    Reusable validation for serializers that include
    'username', 'email', and/or 'password' fields on the User model.
    """

    def validate_username(self, value):
        qs = User.objects.filter(username__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

class PassengerValidationMixin:

    def validate_address(self, value):
        if not value or len(value.strip()) < 5:
            raise serializers.ValidationError("Address must be at least 5 characters long.")
        return value

    def validate_contact_number(self, value):
        if len(value) != 11:
            raise serializers.ValidationError("Contact number must be exactly 11 digits.")
        return value

    def validate_emergency_contact_number(self, value):
        if len(value) != 11:
            raise serializers.ValidationError("Emergency contact number must be exactly 11 digits.")

        contact_number = self.initial_data.get("contact_number")

        if contact_number and value == contact_number:
            raise serializers.ValidationError(
                "Emergency contact number must not be the same as the contact number."
            )

        return value
