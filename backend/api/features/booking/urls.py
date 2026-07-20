from django.urls import path
from .views import BookingView, BookingDetailView, user_bookings, driver_queue, driver_dequeue, driver_queue_status
urlpatterns = [
    path('', BookingView.as_view(), name='booking-list'),
    path('<int:booking_id>/', BookingDetailView.as_view(), name='booking-detail'),
    path('user/', user_bookings, name='user-bookings'),
    path('driver/queue', driver_queue, name="driver-queue"),
    path('driver/dequeue', driver_dequeue, name="driver-dequeue"),
    path('driver/queue/status', driver_queue_status, name='driver-queue-status'),
]
