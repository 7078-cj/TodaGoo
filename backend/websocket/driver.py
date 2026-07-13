import json

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.db import transaction

from ..api.features.booking.models import Booking
from ..api.features.booking.utils import assign_driver_sync
from ..api.features.booking.models import DriverQueue
from django.contrib.gis.geos import Point



class DriverConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.id = self.scope["url_route"]["kwargs"]["user_id"]
        self.group_name = f"driver_{self.id}"

        user = self.scope.get("user")
        if not user or not user.is_authenticated or str(user.id) != str(self.id):
            await self.close(code=4003)
            return

        self.user = user

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        message = json.loads(text_data)

        action = message.get("action")
        booking_id = message.get("booking_id")

        if action == "decline_booking":
            location = message.get("location")
            success = await self.decline_booking(booking_id, location)

            await self.send(text_data=json.dumps({
                "type": "decline_booking",
                "success": success
            }))

        elif action == "accept_booking":
            success = await self.accept_booking(booking_id)

            await self.send(text_data=json.dumps({
                "type": "accept_booking",
                "success": success
            }))

    async def new_booking(self, event):
        await self.send(text_data=json.dumps({
            "type": "new_booking",
            "data": event["data"]
        }))

    @database_sync_to_async
    def accept_booking(self, booking_id):
        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(id=booking_id)
            except Booking.DoesNotExist:
                return False

            if booking.driver_id is not None:
                return False

            if booking.status != Booking.Status.PENDING:
                return False

            driver = self.user.driver

            booking.driver = driver
            booking.status = Booking.Status.ACCEPTED
            booking.save(update_fields=["driver", "status"])

            return True

    @database_sync_to_async
    def decline_booking(self, booking_id, location):
        """
        Driver declined the booking.
        Re-add the driver to the queue, then assign the booking
        to the next available driver.
        """
        driver = self.user.driver

        with transaction.atomic():
            
            DriverQueue.objects.get_or_create(
                driver=driver,
                defaults={
                    "location": Point(
                        float(location["longitude"]),
                        float(location["latitude"]),
                        srid=4326,
                    )
                },
            )

        
            transaction.on_commit(
                lambda: assign_driver_sync(
                    booking_id,
                    exclude_driver_ids=[driver.id],
                )
            )

        return True