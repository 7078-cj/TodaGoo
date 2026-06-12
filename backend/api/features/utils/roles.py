

def is_driver(user):
    return hasattr(user, "driver")

def is_passenger(user):
    return hasattr(user, "passenger")

def is_admin(user):
    return hasattr(user, "admin")