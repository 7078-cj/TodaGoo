from django.db import transaction

from ....broadcast import broadcast
from ..models import DriverQueue

PASSENGERS_ONLINE_GROUP = "passengers_online"


def count_ready_drivers():
    # same filter get_nearest_driver uses, so the count matches who can actually be offered
    return DriverQueue.objects.filter(driver__status="ACTIVE", driver__verified=True).count()


def driver_availability_payload():
    return {"ready_drivers": count_ready_drivers()}


def broadcast_driver_availability():
    transaction.on_commit(
        lambda: broadcast(PASSENGERS_ONLINE_GROUP, "driver_availability", driver_availability_payload())
    )
