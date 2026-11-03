from django.urls import path
from .views import BookingView, BookingDetailView, driver_queue, driver_dequeue, driver_queue_status, RateView, get_fare_price, get_booking_history
urlpatterns = [
    path('', BookingView.as_view(), name='booking-list'),
    path('<int:booking_id>/', BookingDetailView.as_view(), name='booking-detail'),
    path('driver/queue', driver_queue, name="driver-queue"),
    path('driver/dequeue', driver_dequeue, name="driver-dequeue"),
    path('driver/queue/status', driver_queue_status, name='driver-queue-status'),
    path('rate/', RateView.as_view(), name='rate'),
    path('fare/', get_fare_price, name='fare-price'),
    path('history/', get_booking_history, name='booking-history'),
]
