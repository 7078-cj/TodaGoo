import django
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.auth.models import User
from api.user.models import Admin 


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


# Create TODA admin
create_admin("todaAdmin", "toda12345", "TODA")

# Create MDRRMO admin
create_admin("mdrrmoAdmin", "mdrrmo12345", "MDRRMO")

print("Seeding complete.")