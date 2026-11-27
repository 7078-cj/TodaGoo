"""
Small, reusable security helpers. Each one backs a fix listed in SECURITY_FIXES.md,
so a fix can be changed or rolled back in one place.
"""
import json

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

User = get_user_model()


# [SEC-L2] Email lookup that never raises on duplicate / blank emails
def get_user_by_email(email):
    """Return the single user with this email, or None (blank, unknown or ambiguous)."""
    email = str(email or "").strip()
    if not email:
        return None

    matches = list(User.objects.filter(email__iexact=email)[:2])
    return matches[0] if len(matches) == 1 else None


# [SEC-M13] Invalidate every refresh token a user holds (after a password change/reset)
def blacklist_user_tokens(user):
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


# [SEC-M13] Changing a password through a profile update needs the current password
def require_current_password(user, data):
    """
    Raise ValidationError unless `data` has no new password, or carries a correct
    `current_password`. Returns True when the password is being changed.
    """
    if not data.get("password"):
        return False

    current = data.get("current_password")
    if not current or not user.check_password(current):
        raise ValidationError({"current_password": "Current password is incorrect or missing."})
    return True


# [SEC-H6] Status for a newly registered driver
DRIVER_PENDING = "PENDING"
DRIVER_ACTIVE = "ACTIVE"


def initial_driver_status():
    """PENDING (needs TODA admin approval) unless DRIVER_SIGNUP_REQUIRES_APPROVAL=False."""
    return DRIVER_PENDING if settings.DRIVER_SIGNUP_REQUIRES_APPROVAL else DRIVER_ACTIVE


# [SEC-M10] Roles
def is_deletion_allowed(user):
    """Only TODA admins may delete driver/passenger accounts."""
    from .roles import is_toda_admin
    return is_toda_admin(user)


# [SEC-M15] Payload size guards for bookings
def validate_booking_payload(stops, routes):
    """Raise ValidationError when stops/routes exceed the configured limits."""
    max_stops = settings.MAX_BOOKING_STOPS
    if stops is not None and len(stops) > max_stops:
        raise ValidationError({"stops": f"A booking can have at most {max_stops} stops."})

    if routes is not None:
        size = len(json.dumps(routes))
        if size > settings.MAX_ROUTES_JSON_BYTES:
            raise ValidationError({"routes": "Route data is too large."})


# [SEC-M14 / SEC-C4] Coordinate parsing used by websocket messages
def parse_lat_lng(location, lat_key="lat", lng_key="lng"):
    """Return (lat, lng) floats within range, or None if the payload is invalid."""
    if not isinstance(location, dict):
        return None
    try:
        lat = float(location[lat_key])
        lng = float(location[lng_key])
    except (KeyError, TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return lat, lng
