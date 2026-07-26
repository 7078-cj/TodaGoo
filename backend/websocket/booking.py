import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
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

        await self.send(text_data=json.dumps({
            "type": "booking_update",
            "data": data
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    @database_sync_to_async
    def get_booking(self):
        try:
            booking = Booking.objects.select_related(
                'driver', 'driver__user',
                'passenger', 'passenger__user',
            ).get(
                id=self.booking_id,
                status='accepted'
            )
            data = BookingSerializer(booking).data
            return booking, data
        except ObjectDoesNotExist:
            return None