from django.core.cache import cache

# Long enough to outlive a chat session; cleared on chat_close / socket disconnect.
CHAT_PRESENCE_TIMEOUT = 60 * 60 * 2


def _key(booking_id, user_id):
    return f"chat_open:{booking_id}:{user_id}"


def set_chat_open(booking_id, user_id):
    cache.set(_key(booking_id, user_id), True, CHAT_PRESENCE_TIMEOUT)


def set_chat_closed(booking_id, user_id):
    cache.delete(_key(booking_id, user_id))


def is_chat_open(booking_id, user_id):
    return bool(cache.get(_key(booking_id, user_id)))
