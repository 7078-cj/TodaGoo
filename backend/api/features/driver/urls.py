from django.urls import path
from .views import (
    DriverListCreateView,
    DriverRetrieveUpdateDestroyView,
    verify_driver_otp,
    resend_driver_otp
)

urlpatterns = [
    path('', DriverListCreateView.as_view(), name="list_create_driver"),
    path('<int:pk>/', DriverRetrieveUpdateDestroyView.as_view(), name="retrieve_update_delete_driver"),
    path("verify-otp/", verify_driver_otp, name="verify-driver-otp"),
    path("resend-otp/", resend_driver_otp, name="resend-driver-otp")
]
