from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from rest_framework.decorators import api_view, throttle_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import Notification
from .serializers import UserSerializer, NotificationSerializer
from ...rate_limit.TestThrottle import TestThrottle
from rest_framework import status
from .utils import send_reset_email
from ..utils.security import get_user_by_email, blacklist_user_tokens
from ..utils.password_reset import (
    issue_reset_code,
    check_reset_code,
    RESET_OK,
    RESET_INVALID,
    RESET_LOCKED,
    RESET_COOLDOWN,
)
from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from ..utils.roles import get_user_role, get_admin_department

User = get_user_model()


class PasswordResetThrottle(ScopedRateThrottle):
    """[SEC-C2] Per-IP limit for the password reset endpoints (rate: settings 'password_reset')."""
    scope = "password_reset"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}

class AdminMyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not hasattr(self.user, "admin"):
            raise AuthenticationFailed("This account is not an admin.", code="not_admin")
        return data
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        token['username'] = user.username
        token['role'] = get_user_role(user)
        if token['role'] == 'admin':
            token['department'] = get_admin_department(user)

        return token
    
class AdminMyTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]  # [SEC-H5] login is public
    serializer_class = AdminMyTokenObtainPairSerializer


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = get_user_role(user)
        if token['role'] == 'admin':
            token['department'] = get_admin_department(user)
        token['verified'] = (
            user.driver_profile.verified if hasattr(user, 'driver_profile')
            else user.passenger_profile.verified if hasattr(user, 'passenger_profile')
            else None
        )
        return token


class MyTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]  # [SEC-H5] login is public
    serializer_class = MyTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([AllowAny])  # [SEC-H5] public sign-up
def registerUser(request):

    serializer = UserSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(
            {"message": "User registered successfully"},
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_user_notification(request):
    user = request.user
    notifications = user.notifications.all().order_by('-created_at')
    serializer = NotificationSerializer(notifications, many=True)
    return Response(serializer.data)

@api_view(['PATCH'])
def mark_notification_as_read(request, notification_id):
    user = request.user
    try:
        notification = user.notifications.get(id=notification_id)
    except Notification.DoesNotExist:
        return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

    notification.read = True
    notification.save()
    return Response({"message": "Notification marked as read"})

@api_view(['PATCH'])
def mark_all_unread_notifications_as_read(request):
    user = request.user
    unread_notifications = user.notifications.filter(read=False)
    unread_notifications.update(read=True)
    return Response({"message": "All unread notifications marked as read", "Status": "Success"})


# [SEC-C2] Password reset: secure 6-digit codes, attempt limits, resend cooldown,
# per-IP throttle, password validation, and no account enumeration.
# The code logic lives in utils/password_reset.py.
RESET_SENT_MESSAGE = "If an account with that email exists, a reset code was sent."
RESET_INVALID_MESSAGE = "Invalid or expired code."


def _send_reset_code(email):
    """Issue + email a code when the email maps to exactly one user. Always the same reply."""
    user = get_user_by_email(email)
    if user is not None:
        code = issue_reset_code(user)
        if code != RESET_COOLDOWN:
            send_reset_email(user, code)
    return Response({"message": RESET_SENT_MESSAGE})


def _reset_code_error(result):
    if result == RESET_LOCKED:
        return Response(
            {"error": "Too many wrong attempts. Request a new code."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    return Response({"error": RESET_INVALID_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def request_password_reset(request):
    return _send_reset_code(request.data.get("email"))


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def verify_reset_code(request):
    user = get_user_by_email(request.data.get("email"))
    if user is None:
        return _reset_code_error(RESET_INVALID)

    result = check_reset_code(user, request.data.get("code"))
    if result != RESET_OK:
        return _reset_code_error(result)

    return Response({"message": "Code verified", 'is_permitted': True})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def reset_password(request):
    user = get_user_by_email(request.data.get("email"))
    if user is None:
        return _reset_code_error(RESET_INVALID)

    new_password = request.data.get("password") or ""
    try:
        validate_password(new_password, user)
    except DjangoValidationError as e:
        return Response({"password": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    result = check_reset_code(user, request.data.get("code"), consume=True)
    if result != RESET_OK:
        return _reset_code_error(result)

    user.set_password(new_password)
    user.save()
    blacklist_user_tokens(user)  # [SEC-M13] log out every existing session

    return Response({"message": "Password updated"})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def resend_reset_code(request):
    return _send_reset_code(request.data.get("email"))


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([TestThrottle])
def test(request):
    
    return Response('Hello')