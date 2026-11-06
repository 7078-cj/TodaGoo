"""
Forgot password in the app, by SMS code to the account's mobile number.

  1. request_code(phone)            -> a 6-digit code by SMS (utils/otp.py generate_otp / send_otp)
  2. verify_code(phone, code)       -> a short-lived reset token
  3. reset_password(token, password) -> new password saved, every session signed out

- The code is stored hashed (HMAC with SECRET_KEY), never in plain text, for SMS_RESET_OTP_TTL.
- Per number: SMS_RESET_RESEND_COOLDOWN between codes, at most SMS_RESET_MAX_PER_HOUR codes an hour.
- SMS_RESET_MAX_ATTEMPTS wrong codes throw the code away. A code works once.
- The reset token is random (secrets), stored only as its SHA-256, single use, SMS_RESET_TOKEN_TTL.
- A number with no (single) account is told so (NO_ACCOUNT), before any limit is counted, so a
  typo doesn't start a cooldown. A wrong / expired / never-sent code are the same "invalid" result.
Nothing here logs or returns a code, token or password.
"""
import hashlib
import logging
import secrets

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.db.models import Q
from django.utils.crypto import constant_time_compare, salted_hmac

from . import otp
from .security import blacklist_user_tokens
from .validation import normalize_ph_mobile

logger = logging.getLogger(__name__)

# request_code() results
SENT = "sent"            # a code went out
NO_ACCOUNT = "no_account"  # no active passenger / driver uses this number (or more than one does)
COOLDOWN = "cooldown"    # asked again within SMS_RESET_RESEND_COOLDOWN
LIMIT = "limit"          # SMS_RESET_MAX_PER_HOUR reached for this number
SMS_FAILED = "sms_failed"

# verify_code() results
VERIFIED = "verified"
INVALID = "invalid"      # wrong, expired, already used, or never sent
LOCKED = "locked"        # too many wrong codes: the code is gone

# reset_password() results
RESET_DONE = "done"
TOKEN_INVALID = "token_invalid"  # missing, unknown, expired or already used


def _code_key(phone):
    return f"sms_reset_code:{phone}"


def _attempts_key(phone):
    return f"sms_reset_attempts:{phone}"


def _cooldown_key(phone):
    return f"sms_reset_cooldown:{phone}"


def _hourly_key(phone):
    return f"sms_reset_hourly:{phone}"


def _token_key(token):
    return "sms_reset_token:" + hashlib.sha256(token.encode()).hexdigest()


def hash_code(phone, code):
    """Keyed hash of a code, bound to the number (so a code for one number fails on another)."""
    return salted_hmac("sms-password-reset", f"{phone}:{code}").hexdigest()


def code_matches(phone, code, stored_hash):
    return bool(stored_hash) and constant_time_compare(hash_code(phone, str(code or "").strip()), stored_hash)


def find_user_by_phone(phone):
    """
    The active passenger / driver whose contact_number is `phone`, or None.
    contact_number isn't unique: a number on two accounts matches none (we can't tell which
    password to reset), and the caller gives the usual generic reply.
    """
    users = list(
        User.objects.filter(is_active=True, admin__isnull=True)
        .filter(Q(passenger_profile__contact_number=phone) | Q(driver_profile__contact_number=phone))
        .distinct()[:2]
    )
    if len(users) > 1:
        logger.warning("SMS password reset: number is on more than one account; no code sent")
        return None
    return users[0] if users else None


def _count_this_hour(phone):
    key = _hourly_key(phone)
    if cache.add(key, 1, 60 * 60):
        return 1
    try:
        return cache.incr(key)
    except ValueError:  # expired between add and incr
        cache.set(key, 1, 60 * 60)
        return 1


def request_code(phone):
    """
    Send a reset code to `phone` (already normalized).
    Returns SENT, NO_ACCOUNT, COOLDOWN, LIMIT or SMS_FAILED.
    """
    user = find_user_by_phone(phone)
    if user is None:
        return NO_ACCOUNT

    if not cache.add(_cooldown_key(phone), 1, settings.SMS_RESET_RESEND_COOLDOWN):
        return COOLDOWN
    if _count_this_hour(phone) > settings.SMS_RESET_MAX_PER_HOUR:
        return LIMIT

    code = otp.generate_otp()  # fixed "111111" only when ENVIRONMENT == "development"
    cache.set(_code_key(phone), {"user_id": user.pk, "hash": hash_code(phone, code)}, settings.SMS_RESET_OTP_TTL)
    cache.delete(_attempts_key(phone))  # a new code gets a fresh set of tries

    try:
        otp.send_otp(phone, code)
    except Exception:
        # the code never arrived: drop it, and let them ask again straight away
        cache.delete(_code_key(phone))
        cache.delete(_cooldown_key(phone))
        logger.exception("SMS password reset: sending the code failed")
        return SMS_FAILED
    return SENT


def issue_reset_token(user):
    token = secrets.token_urlsafe(32)
    cache.set(_token_key(token), user.pk, settings.SMS_RESET_TOKEN_TTL)
    return token


def user_for_token(token):
    """The user a reset token belongs to, or None (missing, unknown, expired or used)."""
    if not token or not isinstance(token, str):
        return None
    user_id = cache.get(_token_key(token))
    if user_id is None:
        return None
    return User.objects.filter(pk=user_id, is_active=True).first()


def verify_code(phone, code):
    """Check a code. Returns (VERIFIED, reset_token), (INVALID, None) or (LOCKED, None)."""
    attempts_key = _attempts_key(phone)
    if cache.get(attempts_key, 0) >= settings.SMS_RESET_MAX_ATTEMPTS:
        cache.delete(_code_key(phone))
        return LOCKED, None

    stored = cache.get(_code_key(phone))
    if stored and code_matches(phone, code, stored.get("hash")):
        # single use: the code is gone whether or not the token is ever used
        cache.delete(_code_key(phone))
        cache.delete(attempts_key)
        user = User.objects.filter(pk=stored["user_id"], is_active=True).first()
        if user is None:
            return INVALID, None
        return VERIFIED, issue_reset_token(user)

    # wrong, expired or never sent: count it the same way (also for unknown numbers)
    if cache.add(attempts_key, 1, settings.SMS_RESET_OTP_TTL):
        attempts = 1
    else:
        try:
            attempts = cache.incr(attempts_key)
        except ValueError:
            cache.set(attempts_key, 1, settings.SMS_RESET_OTP_TTL)
            attempts = 1
    if attempts >= settings.SMS_RESET_MAX_ATTEMPTS:
        cache.delete(_code_key(phone))
        return LOCKED, None
    return INVALID, None


def reset_password(token, password):
    """
    Set a new password with a reset token from verify_code(). Returns RESET_DONE or TOKEN_INVALID.
    Raises django.core.exceptions.ValidationError for a password that breaks the password rules
    (the token is kept, so they can try another password).
    """
    user = user_for_token(token)
    if user is None:
        return TOKEN_INVALID

    validate_password(password or "", user)

    # single use: whoever deletes the key first wins (two requests with one token can't both reset)
    if not cache.delete(_token_key(token)):
        return TOKEN_INVALID

    user.set_password(password)
    user.save(update_fields=["password"])
    blacklist_user_tokens(user)  # [SEC-M13] sign out every existing session
    return RESET_DONE


__all__ = [
    "normalize_ph_mobile", "request_code", "verify_code", "reset_password", "find_user_by_phone",
    "hash_code", "code_matches", "issue_reset_token", "user_for_token",
    "SENT", "NO_ACCOUNT", "COOLDOWN", "LIMIT", "SMS_FAILED", "VERIFIED", "INVALID", "LOCKED", "RESET_DONE", "TOKEN_INVALID",
]
