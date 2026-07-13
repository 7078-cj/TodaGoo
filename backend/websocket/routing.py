from django.urls import path
from . import consumers
from .driver import DriverConsumer
from .passenger import PassengerConsumer
from .booking import BookingConsumer

websocket_urlpatterns = [
    path('ws/some_path/<str:id>/', consumers.MyWebSocketConsumer.as_asgi()),
    path('ws/driver/<str:user_id>', DriverConsumer.as_asgi()),
    path('ws/passenger/<str:user_id>', PassengerConsumer.as_asgi()),
    path('ws/booking/<str:booking_id>', BookingConsumer.as_asgi()),
    
]