"""
Booking logs: one BookingLog row per thing that happens to a booking, shown in Ride History.

Call the log_* function for the event where it happens. Wording lives here, so every screen
reads the same. A failed log write is reported and swallowed: it never breaks the booking action.
"""
import logging

from django.db import transaction

from .models import BookingLog

logger = logging.getLogger(__name__)
Event = BookingLog.Event


def _name(user):
    if user is None:
        return ""
    full = " ".join(p.capitalize() for p in (user.first_name, user.last_name) if p)
    return full or user.username


def log_booking_event(booking, event, message, actor=None):
    """Write one log row. Returns it, or None if writing failed (logged, not raised)."""
    try:
        with transaction.atomic():  # a savepoint: a failure here leaves the caller's transaction usable
            return BookingLog.objects.create(booking=booking, event=event, message=message[:255], actor=actor)
    except Exception:
        logger.exception("Booking %s: couldn't write the %s log", getattr(booking, "pk", None), event)
        return None


def log_requested(booking):
    route = f"{booking.start_address or 'pickup'} → {booking.end_address or 'drop-off'}"
    price = f" (₱{booking.price:g})" if booking.price is not None else ""
    return log_booking_event(booking, Event.REQUESTED, f"Ride requested: {route}{price}.", actor=booking.passenger.user)


def log_offered(booking):
    # never the driver's name: drivers who don't take the ride stay anonymous
    return log_booking_event(booking, Event.OFFERED, "Offered to a nearby driver.")


def log_offer_declined(booking):
    return log_booking_event(booking, Event.OFFER_DECLINED, "A driver declined. Looking for another driver.")


def log_offer_expired(booking):
    return log_booking_event(booking, Event.OFFER_EXPIRED, "A driver didn't answer in time. Looking for another driver.")


def log_accepted(booking):
    driver = booking.driver
    plate = f" ({driver.vehicle_plate})" if driver and driver.vehicle_plate else ""
    return log_booking_event(
        booking, Event.ACCEPTED, f"Accepted by {_name(driver.user)}{plate}.", actor=driver.user
    )


def log_driver_nearby(booking):
    return log_booking_event(booking, Event.DRIVER_NEARBY, "The driver arrived near the pickup point.")


def log_picked_up(booking):
    return log_booking_event(booking, Event.PICKED_UP, "Passenger picked up.", actor=booking.driver.user)


def log_completed(booking):
    return log_booking_event(booking, Event.COMPLETED, "Ride completed.", actor=booking.driver.user)


def log_cancelled_by_passenger(booking):
    return log_booking_event(booking, Event.CANCELLED, "Cancelled by the passenger.", actor=booking.passenger.user)


def log_rated(rate):
    rater_is_passenger = rate.rater_id == rate.booking.passenger.user_id
    who, whom = ("The passenger", "the driver") if rater_is_passenger else ("The driver", "the passenger")
    stars = "star" if rate.score == 1 else "stars"
    return log_booking_event(rate.booking, Event.RATED, f"{who} rated {whom} {rate.score} {stars}.", actor=rate.rater)

# Incident reports are not logged: they never show in ride history (the reported person is
# never told they were reported, see the reports feature).
