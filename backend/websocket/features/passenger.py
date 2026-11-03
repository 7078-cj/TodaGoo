import json
from channels.generic.websocket import AsyncWebsocketConsumer
from websocket.auth import SubprotocolAcceptMixin
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from api.features.booking.models import Booking
from api.features.booking.serializers import BookingSerializer
from api.features.booking.helpers.driver_availability import PASSENGERS_ONLINE_GROUP, driver_availability_payload


class PassengerConsumer(SubprotocolAcceptMixin, AsyncWebsocketConsumer):  # [SEC-H8]
    async def connect(self):
        self.id = self.scope['url_route']['kwargs']['user_id']
        self.group_name = f'user_{self.id}'

        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated or str(self.user.id) != str(self.id):
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add(PASSENGERS_ONLINE_GROUP, self.channel_name)
        await self.accept()

        await self.send(text_data=json.dumps({
            "type": "driver_availability",
            "data": await database_sync_to_async(driver_availability_payload)(),
        }))


        booking = await self.get_accepted_booking()
        if booking:
            await self.send(text_data=json.dumps({
                "type": "booking_accepted",
                "data": booking
            }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await self.channel_layer.group_discard(PASSENGERS_ONLINE_GROUP, self.channel_name)

    async def booking_accepted(self, event):
        await self.send(text_data=json.dumps({
            "type": "booking_accepted",
            "data": event["data"]
        }))

    async def booking_completed(self, event):
            await self.send(text_data=json.dumps({
                "type": "booking_completed",
                "data": event["data"]
            }))

    async def driver_availability(self, event):
        await self.send(text_data=json.dumps({
            "type": "driver_availability",
            "data": event["data"],
        }))

    # notifications are sent to user_<id>, the same group this consumer joins
    async def notification_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def booking_unavailable(self, event):
        await self.send(text_data=json.dumps({
            "type": "booking_unavailable",
            "data": event["data"]
        }))

    @database_sync_to_async
    def get_accepted_booking(self):
        try:
            passenger = self.user.passenger_profile
            booking = Booking.objects.select_related('passenger','driver').get(
                passenger=passenger,
                status__in=['accepted', 'in_progress'],
            )
            return BookingSerializer(booking).data  
        except ObjectDoesNotExist:
            return None