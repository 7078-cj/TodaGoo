import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.db import transaction
from django.core.cache import cache

from api.features.booking.models import Booking
from api.features.booking.utils import assign_driver_sync
from api.features.booking.models import DriverQueue
from django.contrib.gis.geos import Point
import asyncio


class DriverConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.id = self.scope["url_route"]["kwargs"]["user_id"]
        self.group_name = f"driver_{self.id}"
        self._timeout_tasks = set()

        user = self.scope.get("user")
        if not user or not user.is_authenticated or str(user.id) != str(self.id):
            await self.close(code=4003)
            return

        self.user = user

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.resume_pending_booking()

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

    async def resume_pending_booking(self):
        driver_id = await self.get_driver_id()
        if driver_id is None:
            return

        data = await self.get_cached_booking(driver_id)
        if data is None:
            return

        booking_id = data.get("id")
        if booking_id is None:
            return

        await self.send(text_data=json.dumps({
            "type": "new_booking",
            "data": data,
        }))

    @database_sync_to_async
    def get_driver_id(self):
        driver = getattr(self.user, "driver_profile", None)
        return driver.id if driver else None
    
    @sync_to_async
    def get_cached_booking(self, driver_id):
        return cache.get(f"driver_{driver_id}_booking")

    async def new_booking(self, event):
        booking_id = event["data"]["id"]

        task = asyncio.create_task(self.booking_timeout(booking_id))
        self._timeout_tasks.add(task)
        task.add_done_callback(self._handle_task_result)

        await self.send(text_data=json.dumps({
            "type": "new_booking",
            "data": event["data"],
        }))

    def _handle_task_result(self, task):
        self._timeout_tasks.discard(task)
        if task.cancelled():
            return
        exc = task.exception()
        if exc:
            # Replace with proper logging if desired
            pass

    async def booking_timeout(self, booking_id):
        await asyncio.sleep(30)
        await self.booking_expired(booking_id)

    @database_sync_to_async
    def booking_expired(self, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return

        if booking.status != Booking.Status.PENDING or booking.driver_id is not None:
            return

        driver = getattr(self.user, "driver_profile", None)
        if driver is None:
            return

        cached_location = cache.get(f"driver_{driver.id}_location")
        if cached_location:
            location = Point(cached_location["lng"], cached_location["lat"], srid=4326)
        else:
            location = driver.current_location

        DriverQueue.objects.get_or_create(
            driver=driver,
            defaults={"location": location},
        )

        cache.delete(f"driver_{driver.id}_booking")
        cache.delete(f"driver_{driver.id}_location")

        assign_driver_sync(
            booking.id,
            exclude_driver_ids=[driver.id],
        )

    @database_sync_to_async
    def accept_booking(self, booking_id):
        driver = getattr(self.user, "driver_profile", None)
        if driver is None:
            return {
                "success": False,
                "message": "No driver profile found."
            }

        if DriverQueue.objects.filter(driver=driver).exists():
            return {
                "success": False,
                "message": "Your booking offer has expired."
            }

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(id=booking_id)
            except Booking.DoesNotExist:
                return False

            if booking.driver_id is not None:
                return False

            if booking.status != Booking.Status.PENDING:
                return False

            booking.driver = driver
            booking.status = Booking.Status.ACCEPTED
            booking.save(update_fields=["driver", "status"])

            cache.delete(f"driver_{driver.id}_booking")
            cache.delete(f"driver_{driver.id}_location")

            return True

    @database_sync_to_async
    def decline_booking(self, booking_id, location):
        """
        Driver declined the booking.
        Re-add the driver to the queue, then assign the booking
        to the next available driver.
        """
        driver = getattr(self.user, "driver_profile", None)
        if driver is None:
            return False

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

            cache.delete(f"driver_{driver.id}_booking")
            cache.delete(f"driver_{driver.id}_location")

            transaction.on_commit(
                lambda: assign_driver_sync(
                    booking_id,
                    exclude_driver_ids=[driver.id],
                )
            )

        return True