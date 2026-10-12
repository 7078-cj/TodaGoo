

def is_driver(user):
    return hasattr(user, "driver_profile")

def is_passenger(user):
    return hasattr(user, "passenger_profile")

def is_admin(user):
    return hasattr(user, "admin")
