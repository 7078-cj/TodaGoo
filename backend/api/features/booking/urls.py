from django.urls import path
from .views import BookingView, BookingDetailView
urlpatterns = [
    path('', BookingView.as_view(), name='booking-list'),
    path('<int:booking_id>/', BookingDetailView.as_view(), name='booking-detail'),
]
