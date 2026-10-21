import django
import os
from datetime import time

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.auth.models import User
from api.features.user.models import Admin
from api.features.admin.models import BookingSettings  


def create_admin(username, password, department):
    user, created = User.objects.get_or_create(username=username)

    if created:
        user.set_password(password)
        user.save()
        print(f"User created: {username}")
    else:
        print(f"User already exists: {username}")

    admin_obj, admin_created = Admin.objects.get_or_create(user=user)

    if admin_created:
        admin_obj.department = department
        admin_obj.save()
        print(f"Admin profile created: {department}")
    else:
        print(f"Admin profile already exists: {department}")


def seed_booking_settings():
    # BookingSettings is a single-row table, so only create if none exists
    settings_obj, created = BookingSettings.objects.get_or_create(
        pk=1,
        defaults={
            "night_fare_multiplier": 1.5,
            "night_fare_start_time": time(22, 0),
            "night_fare_multiplier_end_time": time(5, 0),
            "is_night_fare_enabled": False,
        },
    )

    if created:
        print("Booking settings created with default values.")
    else:
        print("Booking settings already exist.")


# Create TODA admin
create_admin("todaAdmin", "toda12345", "TODA")

# Create MDRRMO admin
create_admin("mdrrmoAdmin", "mdrrmo12345", "MDRRMO")

# Seed booking settings
seed_booking_settings()

print("Seeding complete.")