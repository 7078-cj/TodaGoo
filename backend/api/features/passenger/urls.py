from django.urls import path
from .views import (
    PassengerListCreateView,
    PassengerRetrieveUpdateDestroyView,
    verify_passenger_otp,
    resend_passenger_otp
)

urlpatterns = [
    path('', PassengerListCreateView.as_view(), name="list_create_passenger"),
    path('<int:pk>/', PassengerRetrieveUpdateDestroyView.as_view(), name="retrieve_update_delete_passenger"),
    path("verify-otp/", verify_passenger_otp, name="verify-passenger-otp"),
    path("resend-otp/", resend_passenger_otp, name="resend-passenger-otp"),
]
