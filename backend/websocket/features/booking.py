import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from django.core.cache import cache

from api.features.booking.models import Booking
from api.features.booking.serializers import BookingSerializer


class BookingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.booking_id = self.scope['url_route']['kwargs']['booking_id']
        self.group_name = f'booking_{self.booking_id}'

        user = self.scope.get('user')

        if not user or not user.is_authenticated:
            await self.close(code=4003)
            return

        self.user = user

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        result = await self.get_booking()

        if result is None:
            await self.close(code=4004)
            return

        booking, data = result

        is_participant = (
            getattr(booking.driver, 'user_id', None) == user.id or
            getattr(booking.passenger, 'user_id', None) == user.id
        )

        if not is_participant:
            await self.close(code=4003)
            return

        self.booking = booking
        self.is_passenger = getattr(booking.passenger, 'user_id', None) == user.id

        cached_location = cache.get(f"booking_{self.booking_id}_driver_location")
        if cached_location is not None:
            await self.send(text_data=json.dumps({
                "type": "driver_location",
                "data": cached_location
            }))

    async def receive(self, text_data):
        message = json.loads(text_data)
        action = message.get("action")

        if action == "driver_location":
            if not await self.check_driver():
                return

            location = message.get("location")
            cache.set(f"booking_{self.booking_id}_driver_location", location, 20)

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "driver_location",
                    "location": location,
                }
            )


    async def driver_location(self, event):
        await self.send(text_data=json.dumps({
            "type": "driver_location",
            "data": event["location"]
        }))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "message": event["data"],
        }))

    async def messages_seen(self, event):
        await self.send(text_data=json.dumps({
            "type": "messages_seen",
            "message_ids": event["data"],
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    @database_sync_to_async
    def check_driver(self):
        driver_profile = getattr(self.user, 'driver_profile', None)
        if driver_profile is None:
            return False
        return getattr(self.booking.driver, 'user_id', None) == self.user.id

    @database_sync_to_async
    def get_booking(self):
        try:
            booking = Booking.objects.select_related(
                'driver', 'driver__user',
                'passenger', 'passenger__user',
            ).get(
                id=self.booking_id,
                status__in=['accepted', 'in_progress'],
            )
            data = BookingSerializer(booking).data
            return booking, data
        except ObjectDoesNotExist:
            return None