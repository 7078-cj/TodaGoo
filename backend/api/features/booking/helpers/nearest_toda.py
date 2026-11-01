from ...utils.distance import find_station


def get_nearest_toda(booking):
    # The TODA containing the pickup point, or the nearest within the GPS tolerance
    return find_station(booking.start)