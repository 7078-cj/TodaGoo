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


# Each offer is ended exactly once: by accept, decline, or the 30 s timeout, whichever comes first.
# Without this, a decline re-offered the booking and the declining driver's still-running timer
# re-offered it again (duplicate offer), and so did an app auto-decline racing the server timeout.
OFFER_CLAIM_TTL = 120


def _claim_key(driver_id, booking_id):
    return f"offer_claim:{driver_id}:{booking_id}"


def reset_offer_claim(driver_id, booking_id):
    """Called when an offer is made, so the same booking can be offered to the same driver again later."""
    cache.delete(_claim_key(driver_id, booking_id))


def claim_offer(driver_id, booking_id):
    """
    True for the first caller that ends this driver's current offer of `booking_id`, False for
    everyone after (or if it isn't offered to them). The winner owns the follow-up (accept,
    or re-queue + reassign); the offer is removed so nothing else can act on it.
    """
    if not is_booking_offered_to(driver_id, booking_id):
        return False
    # cache.add is atomic: only one of accept / decline / timer (from any socket) gets True
    if not cache.add(_claim_key(driver_id, booking_id), True, OFFER_CLAIM_TTL):
        return False
    cache.delete(f"driver_{driver_id}_booking")
    return True
