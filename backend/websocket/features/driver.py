import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from websocket.auth import SubprotocolAcceptMixin
from channels.db import database_sync_to_async
from django.db import transaction
from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist

from api.features.booking.models import Booking
from api.features.booking.utils import assign_driver_sync
from api.features.booking.models import DriverQueue
from django.contrib.gis.geos import Point
import asyncio
from api.features.booking.serializers import BookingSerializer
from api.features.booking.helpers.offer_guard import claim_offer
from api.broadcast import broadcast
from api.features.utils.security import parse_lat_lng
from api.features.notifications.triggers import notify_booking_accepted
from api.features.booking.logs import log_accepted, log_offer_declined, log_offer_expired


class DriverConsumer(SubprotocolAcceptMixin, AsyncWebsocketConsumer):  # [SEC-H8]
    async def connect(self):
        self.id = self.scope["url_route"]["kwargs"]["user_id"]
        self.group_name = f"driver_{self.id}"
        self._timeout_tasks = set()

        user = self.scope.get("user")
        if not user or not user.is_authenticated or str(user.id) != str(self.id):
            await self.close(code=4003)
            return

        self.user = user
        self.driver = await self.get_driver()

        if self.driver is None:
            await self.close(code=4004)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.resume_pending_booking()
        await self.active_bookings()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            message = json.loads(text_data)
        except (TypeError, ValueError):
            return
        if not isinstance(message, dict):
            return

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
            data = await self.accept_booking(booking_id)

            await self.send(text_data=json.dumps({
                "type": "accept_booking",
                "data": data
            }))

    async def active_bookings(self):
        booking = await self.get_active_booking()
        
        if booking:
            await self.send(text_data=json.dumps({
                    "type": "accept_booking",
                    "data": booking,
                }))


    @database_sync_to_async
    def get_active_booking(self):
        try:
            driver = self.user.driver_profile
            booking = Booking.objects.select_related('driver','passenger').get(
                driver=driver,
                status__in=['accepted', 'in_progress'],
            )
            return BookingSerializer(booking).data  
        except ObjectDoesNotExist:
            return None
    
    async def resume_pending_booking(self):
        data = await self.get_cached_booking(self.driver.id)
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
    def get_driver(self):
        try:
            return self.user.driver_profile
        except ObjectDoesNotExist:
            return None

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
            pass

    async def booking_timeout(self, booking_id):
        await asyncio.sleep(30)
        await self.booking_expired(booking_id)

    @database_sync_to_async
    def booking_expired(self, booking_id):
        driver = self.driver

        # read before claim_offer ends the offer; offer_driver() cached it for this offer
        cached_location = cache.get(f"driver_{driver.id}_location")

        # Accepted / declined already, or another of this driver's sockets expired it first:
        # its follow-up already ran, so doing it again would offer the booking twice.
        if not claim_offer(driver.id, booking_id):
            return

        # close the offer on every socket of this driver (the app's countdown may lag)
        broadcast(f"driver_{driver.user_id}", "offer_expired", {"booking_id": booking_id})

        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return

        if booking.status != Booking.Status.PENDING or booking.driver_id is not None:
            return

        log_offer_expired(booking)

        if cached_location:
            location = Point(cached_location["lng"], cached_location["lat"], srid=4326)
        else:
            # Driver has no current_location field (this used to raise and kill the timer)
            location = driver.toda_station.location if driver.toda_station_id else booking.start

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
        driver = self.driver

        if DriverQueue.objects.filter(driver=driver).exists():
            return {
                "success": False,
                "message": "Your booking offer has expired."
            }

        # [SEC-C4] only the booking currently offered to this driver can be accepted,
        # and only once: the timer or a decline may have ended the offer already
        if not claim_offer(driver.id, booking_id):
            return {"success": False, "message": "This booking offer has expired."}

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(id=booking_id)
            except Booking.DoesNotExist:
                return {"success": False, "message": "Booking not found."}

            if booking.driver_id is not None:
                return {"success": False, "message": "Booking already taken."}

            if booking.status != Booking.Status.PENDING:
                return {"success": False, "message": "Booking is no longer pending."}

            booking.driver = driver
            booking.status = Booking.Status.ACCEPTED
            booking.save(update_fields=["driver", "status"])
            log_accepted(booking)

            cache.delete(f"driver_{driver.id}_booking")
            cache.delete(f"driver_{driver.id}_location")
            data = BookingSerializer(booking).data
            notify_booking_accepted(booking)

        return data

    @database_sync_to_async
    def decline_booking(self, booking_id, location):
        driver = self.driver

        # [SEC-C4] the location must be valid; checked first so a bad payload leaves the offer open
        coords = parse_lat_lng(location, lat_key="latitude", lng_key="longitude")
        if coords is None:
            return False
        lat, lng = coords

        # only the offered booking, and only once (the timer may have ended it already)
        if not claim_offer(driver.id, booking_id):
            return False

        with transaction.atomic():
            DriverQueue.objects.get_or_create(
                driver=driver,
                defaults={"location": Point(lng, lat, srid=4326)},
            )

            booking = Booking.objects.filter(id=booking_id, status=Booking.Status.PENDING).first()
            if booking is not None:
                log_offer_declined(booking)

            cache.delete(f"driver_{driver.id}_booking")
            cache.delete(f"driver_{driver.id}_location")

            transaction.on_commit(
                lambda: assign_driver_sync(
                    booking_id,
                    exclude_driver_ids=[driver.id],
                )
            )

        return True

    async def offer_expired(self, event):
        await self.send(text_data=json.dumps({
            "type": "offer_expired",
            "data": event["data"],
        }))

    async def booking_update(self, event):
            await self.send(text_data=json.dumps({
                "type": "booking_update",
                "data": event["data"]
            }))