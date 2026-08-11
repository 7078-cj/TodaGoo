from django.urls import path
from .views import (
    PassengerListCreateView,
    PassengerRetrieveUpdateDestroyView
)

urlpatterns = [
    path('', PassengerListCreateView.as_view(), name="list_create_passenger"),
    path('<int:pk>/', PassengerRetrieveUpdateDestroyView.as_view(), name="retrieve_update_delete_passenger"),
]
