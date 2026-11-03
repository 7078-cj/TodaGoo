import json
from channels.generic.websocket import AsyncWebsocketConsumer
from websocket.auth import SubprotocolAcceptMixin
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from django.core.cache import cache

from api.features.booking.models import Booking
from api.features.booking.serializers import BookingSerializer
from api.features.utils.security import parse_lat_lng
from api.features.notifications.triggers import notify_if_driver_nearby
from api.features.notifications.chat_presence import set_chat_open, set_chat_closed


class BookingConsumer(SubprotocolAcceptMixin, AsyncWebsocketConsumer):  # [SEC-H8]
    async def connect(self):
        self.booking_id = self.scope['url_route']['kwargs']['booking_id']
        self.group_name = f'booking_{self.booking_id}'

        user = self.scope.get('user')

        if not user or not user.is_authenticated:
            await self.close(code=4003)
            return

        self.user = user

        # [SEC-M14] check the booking + participant BEFORE joining the group,
        # so non-participants never receive a single broadcast.
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

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        cached_location = cache.get(f"booking_{self.booking_id}_driver_location")
        if cached_location is not None:
            await self.send(text_data=json.dumps({
                "type": "driver_location",
                "data": cached_location
            }))

    async def receive(self, text_data):
        try:
            message = json.loads(text_data)
        except (TypeError, ValueError):
            return
        if not isinstance(message, dict):
            return
        action = message.get("action")

        if action == "driver_location":
            if not await self.check_driver():
                return

            # [SEC-M14] only forward a well-formed expo-location payload
            # ({"coords": {"latitude", "longitude"}}), stripped to those two numbers.
            raw = message.get("location")
            coords = parse_lat_lng(
                raw.get("coords") if isinstance(raw, dict) else None,
                lat_key="latitude",
                lng_key="longitude",
            )
            if coords is None:
                return
            location = {"coords": {"latitude": coords[0], "longitude": coords[1]}}
            cache.set(f"booking_{self.booking_id}_driver_location", location, 20)

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "driver_location",
                    "location": location,
                }
            )

            await database_sync_to_async(notify_if_driver_nearby)(self.booking_id, coords[0], coords[1])

        elif action == "chat_open":
            await database_sync_to_async(set_chat_open)(self.booking_id, self.user.id)

        elif action == "chat_close":
            await database_sync_to_async(set_chat_closed)(self.booking_id, self.user.id)


    async def driver_location(self, event):
        await self.send(text_data=json.dumps({
            "type": "driver_location",
            "data": event["location"]
        }))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "data": event["data"],
        }))

    async def messages_seen(self, event):
        await self.send(text_data=json.dumps({
            "type": "messages_seen",
            "data": event["data"],
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if hasattr(self, "booking"):
            await database_sync_to_async(set_chat_closed)(self.booking_id, self.user.id)

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