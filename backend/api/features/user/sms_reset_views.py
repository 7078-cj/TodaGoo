"""
Forgot password in the app, by SMS code (logic: api/features/utils/sms_password_reset.py).

    POST user/sms-reset/request/   {"phone"}            -> code sent (404 when no account uses the number)
    POST user/sms-reset/verify/    {"phone", "otp"}     -> {"reset_token", "expires_in"}
    POST user/sms-reset/confirm/   {"reset_token", "password"} -> password changed, sessions ended

Errors use the API's usual shape: {"error": "..."} (plus {"phone": ...} / {"password": [...]} for
field errors), with retry_after on cooldowns. Nothing here returns a code or a password.
In its own module because utils/otp.py imports user/views.py.
"""
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from ..utils import sms_password_reset as reset
from ..utils.validation import normalize_ph_mobile

SENT_MESSAGE = "We sent a 6-digit code to this number."
NO_ACCOUNT_MESSAGE = "No account is registered with this number."
INVALID_PHONE_MESSAGE = "Enter a valid mobile number (e.g. 09123456789)."
INVALID_CODE_MESSAGE = "Invalid or expired code."
LOCKED_MESSAGE = "Too many wrong attempts. Request a new code."
TOKEN_MESSAGE = "Your reset session has expired. Start again."


class SmsPasswordResetThrottle(SimpleRateThrottle):
    """Per-IP limit on the SMS forgot-password endpoints (rate: settings 'sms_password_reset')."""
    scope = "sms_password_reset"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def _phone_or_error(request):
    phone = normalize_ph_mobile(request.data.get("phone"))
    if phone is None:
        return None, Response({"phone": INVALID_PHONE_MESSAGE, "error": INVALID_PHONE_MESSAGE},
                                status=status.HTTP_400_BAD_REQUEST)
    return phone, None


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SmsPasswordResetThrottle])
def request_sms_reset(request):
    phone, error = _phone_or_error(request)
    if error:
        return error

    result = reset.request_code(phone)
    if result == reset.NO_ACCOUNT:
        return Response({"phone": NO_ACCOUNT_MESSAGE, "error": NO_ACCOUNT_MESSAGE},
                        status=status.HTTP_404_NOT_FOUND)
    if result == reset.COOLDOWN:
        wait = settings.SMS_RESET_RESEND_COOLDOWN
        return Response(
            {"error": f"Please wait {wait} seconds before requesting a new code.", "retry_after": wait},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if result == reset.LIMIT:
        return Response(
            {"error": "Too many code requests for this number. Try again in an hour.", "retry_after": 3600},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if result == reset.SMS_FAILED:
        return Response(
            {"error": "We couldn't send the code. Please try again in a moment."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response(
        {"message": SENT_MESSAGE, "retry_after": settings.SMS_RESET_RESEND_COOLDOWN},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SmsPasswordResetThrottle])
def verify_sms_reset(request):
    phone, error = _phone_or_error(request)
    if error:
        return error

    result, token = reset.verify_code(phone, request.data.get("otp"))
    if result == reset.VERIFIED:
        return Response(
            {"message": "Code verified.", "reset_token": token, "expires_in": settings.SMS_RESET_TOKEN_TTL},
            status=status.HTTP_200_OK,
        )
    if result == reset.LOCKED:
        return Response({"error": LOCKED_MESSAGE}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    return Response({"error": INVALID_CODE_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SmsPasswordResetThrottle])
def confirm_sms_reset(request):
    try:
        result = reset.reset_password(request.data.get("reset_token"), request.data.get("password"))
    except DjangoValidationError as e:
        messages = list(e.messages)
        return Response({"password": messages, "error": messages[0]}, status=status.HTTP_400_BAD_REQUEST)

    if result == reset.TOKEN_INVALID:
        return Response({"error": TOKEN_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"message": "Password updated. Log in with your new password."}, status=status.HTTP_200_OK)
