from django.conf import settings
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (registerUser, 
                    MyTokenObtainPairView, 
                    test, 
                    request_password_reset, 
                    verify_reset_code, 
                    reset_password, 
                    resend_reset_code, 
                    AdminMyTokenObtainPairView,
                    get_user_notification,
                    mark_notification_as_read,
                    mark_all_unread_notifications_as_read,
                    change_password)


urlpatterns = [
    path('token/admin', AdminMyTokenObtainPairView.as_view(), name='token_obtain_pair_admin'),
    path('token/user', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', registerUser, name='register_user'),
    path("forgot-password/", request_password_reset, name='request_password_reset'),
    path("verify-code/", verify_reset_code, name='verify_reset_code'),
    path("reset-password/", reset_password, name='reset_password'),
    path("resend-code/", resend_reset_code, name='resend_code'),
    path("change-password/", change_password, name='change_password'),
    path("notifications/", get_user_notification, name='get_user_notification'),
    path("notifications/mark-as-read/<int:notification_id>/", mark_notification_as_read, name='mark_notification_as_read'),
    path("notifications/mark-all-as-read/", mark_all_unread_notifications_as_read, name='mark_all_unread_notifications_as_read'),
    
]

# [SEC-L3] The throttle test endpoint is only routed in development.
if settings.DEBUG:
    urlpatterns.append(path('test/', test, name='test'))