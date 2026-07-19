# mixins.py
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
import re


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

    def validate(self, attrs):
        contact_number = attrs.get("contact_number")
        emergency_contact_number = attrs.get("emergency_contact_number")

        if emergency_contact_number:
            if len(emergency_contact_number) != 11:
                raise serializers.ValidationError({
                    "emergency_contact_number": "Emergency contact number must be exactly 11 digits."
                })

            if contact_number and emergency_contact_number == contact_number:
                raise serializers.ValidationError({
                    "emergency_contact_number": "Emergency contact number must not be the same as the contact number."
                })

        return attrs

    def validate_address(self, value):
        if not value or len(value.strip()) < 5:
            raise serializers.ValidationError("Address must be at least 5 characters long.")
        return value

    def validate_contact_number(self, value):
        if len(value) != 11:
            raise serializers.ValidationError("Contact number must be exactly 11 digits.")
        return value
    


class DriverValidationMixin:

    def validate_address(self, value):
        if not value or len(value.strip()) < 5:
            raise serializers.ValidationError(
                "Address must be at least 5 characters long."
            )
        return value

    def validate_contact_number(self, value):
        value = str(value)

        if not value.isdigit():
            raise serializers.ValidationError(
                "Contact number must contain only digits."
            )

        if len(value) != 11:
            raise serializers.ValidationError(
                "Contact number must be exactly 11 digits."
            )

        return value

    def validate_toda_number(self, value):
        """
        Format: 01-DDD to 11-DDD
        Examples:
        01-123
        10-400
        11-999
        """

        pattern = r'^(0[1-9]|1[01])-\d{3}$'

        if not re.fullmatch(pattern, value):
            raise serializers.ValidationError(
                "Format must be 01-XXX to 11-XXX (e.g., 01-123 or 10-400)"
            )

        return value

    def validate_vehicle_plate(self, value):
        """
        Basic PH plate validation (flexible).
        Accepts formats like:
        ABC1234, ABC-1234, XYZ 5678
        """
        pattern = r'^[A-Z]{2,3}[-\s]?\d{3,4}$'

        if not re.match(pattern, value.upper()):
            raise serializers.ValidationError(
                "Invalid vehicle plate format (e.g., ABC1234 or ABC-1234)."
            )

        return value.upper()

    def validate_license_number(self, value):
        if not value or len(value.strip()) < 6:
            raise serializers.ValidationError(
                "License number must be at least 6 characters long."
            )
        return value

    def validate_franchise_permit_number(self, value):
        if not value or len(value.strip()) < 5:
            raise serializers.ValidationError(
                "Franchise permit number must be at least 5 characters long."
            )
        return value
