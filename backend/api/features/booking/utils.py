from django.db import transaction

from .models import Booking
from .serializers import BookingSerializer

from .helpers.booking_error import booking_error
from .helpers.nearest_toda import get_nearest_toda
from .helpers.nearest_toda_station import get_nearest_toda_station
from .helpers.nearest_driver import get_nearest_driver
from .helpers.offer_driver import offer_driver


def assign_driver_sync(booking_id, exclude_driver_ids=None):
    if exclude_driver_ids is None:
        exclude_driver_ids = []

    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            return

        passenger_user_id = booking.passenger.user.id

        if booking.status != Booking.Status.PENDING or booking.driver_id is not None:
            booking_error("Booking is accepted", passenger_user_id, booking, transaction)
            return

        toda = get_nearest_toda(booking)
        if toda is None:
            booking_error("Booking is outside the available Toda Jurisdiction", passenger_user_id, booking, transaction)
            return

        toda_station = get_nearest_toda_station(booking)
        if toda_station is None:
            booking_error("No nearest Toda Stations", passenger_user_id, booking, transaction)
            return

        nearest = get_nearest_driver(toda, toda_station, exclude_driver_ids, booking)

        data = BookingSerializer(booking).data

        if nearest:
            offer_driver(nearest, transaction, data)
        else:
            booking_error("No drivers are currently available.", passenger_user_id, booking, transaction)