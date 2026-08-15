from django.urls import path
from . import consumers
from .features.driver import DriverConsumer
from .features.passenger import PassengerConsumer
from .features.booking import BookingConsumer
from .features.reports import ReportsConsumer

websocket_urlpatterns = [
    path('ws/some_path/<str:id>/', consumers.MyWebSocketConsumer.as_asgi()),
    path('ws/driver/<str:user_id>', DriverConsumer.as_asgi()),
    path('ws/passenger/<str:user_id>', PassengerConsumer.as_asgi()),
    path('ws/booking/<str:booking_id>', BookingConsumer.as_asgi()),
    path('ws/reports/<str:department>', ReportsConsumer.as_asgi()),
]