def is_driver(user):
    return hasattr(user, "driver_profile")


def is_passenger(user):
    return hasattr(user, "passenger_profile")


def is_admin(user):
    return hasattr(user, "admin")


def get_admin_department(user):
    admin = getattr(user, "admin", None)
    return getattr(admin, "department", None)


def is_toda_admin(user):
    return bool(user and user.is_authenticated and get_admin_department(user) == "TODA")


def is_mdrrmo_admin(user):
    return bool(user and user.is_authenticated and get_admin_department(user) == "MDRRMO")


def get_user_role(user):
    if hasattr(user, "admin"):
        return "admin"
    if hasattr(user, "passenger_profile"):
        return "passenger"
    if hasattr(user, "driver_profile"):
        return "driver"
    return "unknown"
