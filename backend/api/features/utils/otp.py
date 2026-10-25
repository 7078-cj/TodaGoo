# api/features/utils/otp.py  (adjust the location to taste)
import logging
import secrets
import threading

from django.conf import settings
from django.core.cache import cache
from django.utils.crypto import constant_time_compare
from django.db import transaction
import re
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# Roles namespace the cache keys, because a driver and a passenger can share the same pk
ROLE_DRIVER = "driver"
ROLE_PASSENGER = "passenger"

OTP_TTL_SECONDS = 5 * 60       # how long a code stays valid
MAX_ATTEMPTS = 5               # wrong guesses allowed before the code is thrown away
DEV_OTP = "111111"             # fixed code used only when ENVIRONMENT == "development"

RESEND_COOLDOWN_SECONDS = 60   # minimum gap between resends
MAX_RESENDS_PER_HOUR = 5       # protects SMS cost / abuse

# check_otp() results
OTP_OK = "ok"
OTP_INVALID = "invalid"
OTP_EXPIRED = "expired"
OTP_LOCKED = "locked"

# regenerate_otp() results
RESEND_OK = "ok"
RESEND_COOLDOWN = "cooldown"
RESEND_LIMIT = "limit"

def _queue_otp(role, instance):
    pk = instance.pk
    contact_number = instance.contact_number

    # Only after the DB transaction commits, so a rolled-back registration leaves no OTP behind
    transaction.on_commit(lambda: issue_and_send_otp(role, pk, contact_number))


def _otp_key(role, pk) -> str:
    return f"{role}_otp:{pk}"


def _attempts_key(role, pk) -> str:
    return f"{role}_otp_attempts:{pk}"


def _cooldown_key(role, pk) -> str:
    return f"{role}_otp_cooldown:{pk}"


def _resend_count_key(role, pk) -> str:
    return f"{role}_otp_resends:{pk}"


def generate_otp() -> str:
    """Fixed code in development, random 6 digits everywhere else."""
    if settings.ENVIRONMENT == "development":
        return DEV_OTP
    return f"{secrets.randbelow(10**6):06d}"


def issue_otp(role, pk) -> str:
    """Create a code, cache it (replacing any previous one) and return it."""
    code = generate_otp()
    cache.set(_otp_key(role, pk), code, OTP_TTL_SECONDS)
    cache.delete(_attempts_key(role, pk))
    return code


def issue_and_send_otp(role, pk, contact_number) -> None:
    """Issue a fresh code and send it from a background thread."""
    code = issue_otp(role, pk)
    threading.Thread(target=send_otp, args=(contact_number, code), daemon=True).start()


def regenerate_otp(role, pk, contact_number) -> str:
    """
    Replace the OTP with a new one (also clears the wrong-attempt counter, so a
    locked user can try again). Rate limited. Returns one of the RESEND_* constants.
    """
    # cache.add is atomic: it only succeeds if the cooldown key doesn't exist yet
    if not cache.add(_cooldown_key(role, pk), 1, RESEND_COOLDOWN_SECONDS):
        return RESEND_COOLDOWN

    count_key = _resend_count_key(role, pk)
    try:
        count = cache.incr(count_key)
    except ValueError:  # first resend this hour
        cache.set(count_key, 1, 60 * 60)
        count = 1

    if count > MAX_RESENDS_PER_HOUR:
        return RESEND_LIMIT

    issue_and_send_otp(role, pk, contact_number)
    return RESEND_OK


def check_otp(role, pk, submitted) -> str:
    """Compare `submitted` with the cached code. Returns one of the OTP_* constants."""
    otp_key = _otp_key(role, pk)
    attempts_key = _attempts_key(role, pk)

    stored = cache.get(otp_key)
    if stored is None:
        return OTP_EXPIRED

    if cache.get(attempts_key, 0) >= MAX_ATTEMPTS:
        cache.delete(otp_key)
        return OTP_LOCKED

    if constant_time_compare(stored, str(submitted).strip()):
        cache.delete(otp_key)
        cache.delete(attempts_key)
        return OTP_OK

    try:
        attempts = cache.incr(attempts_key)
    except ValueError:  # key didn't exist yet
        cache.set(attempts_key, 1, OTP_TTL_SECONDS)
        attempts = 1

    if attempts >= MAX_ATTEMPTS:
        cache.delete(otp_key)
        return OTP_LOCKED

    return OTP_INVALID


def send_otp(contact_number: str, code: str) -> None:
    """
    SMS service stub.
    - development: log the code so you can see it in the console (mock send)
    - anything else: no-op for now; plug the real SMS provider in here
    """
    if settings.ENVIRONMENT == "development":
        logger.info("[MOCK SMS] OTP %s -> %s", code, contact_number)
        return

    # TODO: integrate the real SMS provider. Never log the code outside development.
    pass


def _verify_otp(request, model, role):
    profile = model.objects.filter(user=request.user).first()
    if profile is None:
        return Response({"error": f"{model.__name__} profile not found."}, status=status.HTTP_404_NOT_FOUND)

    if profile.verified:
        return Response({"message": f"{model.__name__} is already verified."}, status=status.HTTP_200_OK)

    otp = str(request.data.get("otp", "")).strip()
    if not re.fullmatch(r"\d{6}", otp):
        return Response({"error": "OTP must be 6 digits."}, status=status.HTTP_400_BAD_REQUEST)

    result = check_otp(role, profile.pk, otp)

    if result == OTP_OK:
        profile.verified = True
        profile.save(update_fields=["verified"])
        return Response({"message": f"{model.__name__} verified."}, status=status.HTTP_200_OK)

    if result == OTP_LOCKED:
        return Response(
            {"error": "Too many wrong attempts. Request a new OTP."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if result == OTP_EXPIRED:
        return Response(
            {"error": "OTP expired or not found. Request a new OTP."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)


def _resend_otp(request, model, role):
    profile = model.objects.filter(user=request.user).first()
    if profile is None:
        return Response({"error": f"{model.__name__} profile not found."}, status=status.HTTP_404_NOT_FOUND)

    if profile.verified:
        return Response({"error": f"{model.__name__} is already verified."}, status=status.HTTP_400_BAD_REQUEST)

    result = regenerate_otp(role, profile.pk, profile.contact_number)

    if result == RESEND_COOLDOWN:
        return Response(
            {
                "error": f"Please wait {RESEND_COOLDOWN_SECONDS} seconds before requesting a new OTP.",
                "retry_after": RESEND_COOLDOWN_SECONDS,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if result == RESEND_LIMIT:
        return Response(
            {"error": "Too many OTP requests. Try again later."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return Response({"message": "A new OTP has been sent."}, status=status.HTTP_200_OK)