from django.urls import path
from .views import (
    DriverListCreateView,
    DriverRetrieveUpdateDestroyView
)

urlpatterns = [
    path('driver/', DriverListCreateView.as_view(), name="list_create_driver"),
    path('driver/<int:pk>', DriverRetrieveUpdateDestroyView.as_view(), name="retrieve_update_delete_driver"),
]
