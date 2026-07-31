from django.core.cache import cache
import time
from ....broadcast import broadcast

def offer_driver(nearest, transaction, data):
    driver_id = nearest.driver.id
    driver_user_id = nearest.driver.user.id
    location = {"lat": nearest.location.y, "lng": nearest.location.x}

    nearest.delete()  

    def _on_commit():
        expires_at = time.time() + 30
        data_with_expiry = {**data, "expires_at": expires_at}

        cache.set(f'driver_{driver_id}_location', location, timeout=40)
        cache.set(f'driver_{driver_id}_booking', data_with_expiry, timeout=30)
        broadcast(f'driver_{driver_user_id}', 'new_booking', data_with_expiry)


    transaction.on_commit(_on_commit)