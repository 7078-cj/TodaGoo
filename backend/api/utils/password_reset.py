"""
[SEC-C2] Password reset codes.

- 6-digit codes from `secrets` (not `random`)
- wrong guesses are counted; the code is thrown away after PASSWORD_RESET_MAX_ATTEMPTS
- resends have a cooldown
- keys are per user id, so "A@x.com" and "a@x.com" share one code
"""
import secrets

from django.conf import settings
from django.core.cache import cache
from django.utils.crypto import constant_time_compare

RESET_OK = "ok"
RESET_INVALID = "invalid"
RESET_EXPIRED = "expired"
RESET_LOCKED = "locked"
RESET_COOLDOWN = "cooldown"


def _code_key(user_id):
    return f"password_reset_code:{user_id}"


def _attempts_key(user_id):
    return f"password_reset_attempts:{user_id}"


def _cooldown_key(user_id):
    return f"password_reset_cooldown:{user_id}"


def generate_reset_code():
    return f"{secrets.randbelow(10**6):06d}"


def issue_reset_code(user):
    """Store a fresh code for `user`. Returns the code, or RESET_COOLDOWN if asked too soon."""
    if not cache.add(_cooldown_key(user.pk), 1, settings.PASSWORD_RESET_RESEND_COOLDOWN):
        return RESET_COOLDOWN

    code = generate_reset_code()
    cache.set(_code_key(user.pk), code, settings.PASSWORD_RESET_CODE_TTL)
    cache.delete(_attempts_key(user.pk))
    return code


def check_reset_code(user, submitted, consume=False):
    """
    Compare `submitted` with the stored code. `consume=True` deletes the code on success
    (use it for the final reset step, not for the verify step).
    """
    code_key = _code_key(user.pk)
    attempts_key = _attempts_key(user.pk)

    stored = cache.get(code_key)
    if stored is None:
        return RESET_EXPIRED

    if cache.get(attempts_key, 0) >= settings.PASSWORD_RESET_MAX_ATTEMPTS:
        cache.delete(code_key)
        return RESET_LOCKED

    if constant_time_compare(stored, str(submitted or "").strip()):
        if consume:
            cache.delete(code_key)
            cache.delete(attempts_key)
        return RESET_OK

    try:
        attempts = cache.incr(attempts_key)
    except ValueError:  # first wrong guess
        cache.set(attempts_key, 1, settings.PASSWORD_RESET_CODE_TTL)
        attempts = 1

    if attempts >= settings.PASSWORD_RESET_MAX_ATTEMPTS:
        cache.delete(code_key)
        return RESET_LOCKED

    return RESET_INVALID
