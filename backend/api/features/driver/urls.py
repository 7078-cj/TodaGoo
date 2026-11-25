from django.urls import path
from .views import (
    DriverListCreateView,
    DriverRetrieveUpdateDestroyView,
    check_or_send_verification_otp,
    get_profile,
    get_earnings,
    verify_driver_otp,
    resend_driver_otp
)

urlpatterns = [
    path('', DriverListCreateView.as_view(), name="list_create_driver"),
    path('<int:pk>/', DriverRetrieveUpdateDestroyView.as_view(), name="retrieve_update_delete_driver"),
    path("verify-otp/", verify_driver_otp, name="verify-driver-otp"),
    path("resend-otp/", resend_driver_otp, name="resend-driver-otp"),
    path("me/", get_profile, name="driver-profile"),
    path("earnings/", get_earnings, name="driver-earnings"),
    path("otp/check/", check_or_send_verification_otp, name="check-driver-otp")
]
