from django.core.cache import cache


# [SEC-C4] offer_driver() caches the offer under driver_{id}_booking for 30 seconds.
# A driver may only accept/decline the booking that is currently offered to them.
def get_offered_booking_id(driver_id):
    offer = cache.get(f"driver_{driver_id}_booking")
    if not isinstance(offer, dict):
        return None
    return offer.get("id")


def is_booking_offered_to(driver_id, booking_id):
    offered_id = get_offered_booking_id(driver_id)
    return offered_id is not None and str(offered_id) == str(booking_id)
