from django.core.cache import cache

from ..booking.helpers.pickup_proximity import is_near_pickup
from ..booking.models import Booking
from ..user.utils import create_notification
from .chat_presence import is_chat_open

DRIVER_NEARBY_FLAG_TIMEOUT = 60 * 60 * 24


def notify_booking_accepted(booking):
    create_notification(
        booking.passenger.user,
        f"Your booking #{booking.id} was accepted by {booking.driver.user.username}.",
    )


def notify_if_driver_nearby(booking_id, lat, lng):
    flag = f"booking_{booking_id}_driver_nearby_notified"
    # runs on every location update, so skip the DB once the passenger was told
    if cache.get(flag):
        return False

    try:
        booking = Booking.objects.select_related("passenger__user").get(id=booking_id)
    except Booking.DoesNotExist:
        return False

    # only before pickup; once the ride starts the passenger is already on board
    if booking.status != Booking.Status.ACCEPTED:
        return False

    if not is_near_pickup(booking, lat, lng):
        return False

    # cache.add is atomic: only the first location update inside the radius notifies
    if not cache.add(flag, True, DRIVER_NEARBY_FLAG_TIMEOUT):
        return False

    create_notification(
        booking.passenger.user,
        "Your driver is near your pickup location.",
    )
    return True


def notify_reported_user(report):
    booking = report.booking
    driver_user = booking.driver.user if booking.driver_id else None
    passenger_user = booking.passenger.user

    if report.reported_by_id == passenger_user.id:
        reported = driver_user
    elif driver_user is not None and report.reported_by_id == driver_user.id:
        reported = passenger_user
    else:
        # filed by an admin: there is no single reported party
        return

    if reported is None:
        return

    create_notification(
        reported,
        f"You were reported for {report.get_incident_types_display().lower()} on booking #{booking.id}.",
    )


def notify_new_message(message):
    if is_chat_open(message.booking_id, message.receiver_id):
        return

    create_notification(
        message.receiver,
        f"New message from {message.sender.username}: {message.message[:80]}",
    )
