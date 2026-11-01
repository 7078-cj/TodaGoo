from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from rest_framework.decorators import api_view, throttle_classes

from .models import Notification
from .serializers import UserSerializer, NotificationSerializer
from ...rate_limit.TestThrottle import TestThrottle
from rest_framework import status
from .utils import generate_pin, send_reset_email
from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from ..utils.roles import get_user_role, get_admin_department

User = get_user_model()

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
    serializer_class = MyTokenObtainPairSerializer


@api_view(['POST'])
def registerUser(request):

    serializer = UserSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(
            {"message": "User registered successfully"},
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


RESET_CODE_TIMEOUT = 300 

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


@api_view(["POST"])
def request_password_reset(request):

    email = request.data.get("email")

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)

    code = generate_pin()

    cache.set(
        f"reset_code_{email}",
        code,
        timeout=RESET_CODE_TIMEOUT
    )

    send_reset_email(user, code)

    return Response({"message": "Reset code sent"})

@api_view(["POST"])
def verify_reset_code(request):

    email = request.data.get("email")
    code = request.data.get("code")

    stored_code = cache.get(f"reset_code_{email}")

    if stored_code is None:
        return Response(
            {"error": "Code expired or not requested"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if stored_code != code:
        return Response(
            {"error": "Invalid code"},
            status=status.HTTP_400_BAD_REQUEST
        )

    return Response({"message": "Code verified", 'is_permitted': True})

@api_view(["POST"])
def reset_password(request):

    email = request.data.get("email")
    code = request.data.get("code")
    new_password = request.data.get("password")

    stored_code = cache.get(f"reset_code_{email}")

    if stored_code is None:
        return Response(
            {"error": "Code expired"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if stored_code != code:
        return Response(
            {"error": "Invalid code"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {"error": "User not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    user.set_password(new_password)
    user.save()

    cache.delete(f"reset_code_{email}")

    return Response({"message": "Password updated"})

@api_view(["POST"])
def resend_reset_code(request):

    email = request.data.get("email")

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {"error": "User not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    code = generate_pin()

    cache.set(
        f"reset_code_{email}",
        code,
        timeout=RESET_CODE_TIMEOUT
    )

    send_reset_email(user, code)

    return Response({"message": "New reset code sent"})


@api_view(['GET'])
@throttle_classes([TestThrottle])
def test(request):
    
    return Response('Hello')