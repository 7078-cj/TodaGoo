# api/features/utils/otp.py  (adjust the location to taste)
import logging
import secrets
import threading

from django.conf import settings
from django.core.cache import cache
from django.utils.crypto import constant_time_compare

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 5 * 60   # how long a code stays valid
MAX_ATTEMPTS = 5           # wrong guesses allowed before the code is thrown away
DEV_OTP = "111111"         # fixed code used only when ENVIRONMENT == "development"

RESEND_COOLDOWN_SECONDS = 60   # minimum gap between resends
MAX_RESENDS_PER_HOUR = 5       # protects SMS cost / abuse

# check_otp() results
OTP_OK = "ok"
OTP_INVALID = "invalid"
OTP_EXPIRED = "expired"
OTP_LOCKED = "locked"

# regenerate_otp() results
RESEND_OK = "ok"
RESEND_COOLDOWN = "cooldown"
RESEND_LIMIT = "limit"


def _otp_key(driver_id) -> str:
    return f"driver_otp:{driver_id}"


def _attempts_key(driver_id) -> str:
    return f"driver_otp_attempts:{driver_id}"


def _cooldown_key(driver_id) -> str:
    return f"driver_otp_cooldown:{driver_id}"


def _resend_count_key(driver_id) -> str:
    return f"driver_otp_resends:{driver_id}"


def generate_otp() -> str:
    """Fixed code in development, random 6 digits everywhere else."""
    if settings.ENVIRONMENT == "development":
        return DEV_OTP
    return f"{secrets.randbelow(10**6):06d}"


def issue_otp(driver_id) -> str:
    """Create a code, cache it (replacing any previous one) and return it."""
    code = generate_otp()
    cache.set(_otp_key(driver_id), code, OTP_TTL_SECONDS)
    cache.delete(_attempts_key(driver_id))
    return code


def issue_and_send_otp(driver_id, contact_number) -> None:
    """Issue a fresh code and send it from a background thread."""
    code = issue_otp(driver_id)
    threading.Thread(target=send_otp, args=(contact_number, code), daemon=True).start()


def regenerate_otp(driver_id, contact_number) -> str:
    """
    Replace the driver's OTP with a new one (also clears the wrong-attempt counter,
    so a locked driver can try again). Rate limited. Returns one of the RESEND_* constants.
    """
    # cache.add is atomic: it only succeeds if the cooldown key doesn't exist yet
    if not cache.add(_cooldown_key(driver_id), 1, RESEND_COOLDOWN_SECONDS):
        return RESEND_COOLDOWN

    count_key = _resend_count_key(driver_id)
    try:
        count = cache.incr(count_key)
    except ValueError:  # first resend this hour
        cache.set(count_key, 1, 60 * 60)
        count = 1

    if count > MAX_RESENDS_PER_HOUR:
        return RESEND_LIMIT

    issue_and_send_otp(driver_id, contact_number)
    return RESEND_OK


def check_otp(driver_id, submitted) -> str:
    """Compare `submitted` with the cached code. Returns one of the OTP_* constants."""
    otp_key = _otp_key(driver_id)
    attempts_key = _attempts_key(driver_id)

    stored = cache.get(otp_key)
    if stored is None:
        return OTP_EXPIRED

    if cache.get(attempts_key, 0) >= MAX_ATTEMPTS:
        cache.delete(otp_key)
        return OTP_LOCKED

    if constant_time_compare(stored, str(submitted).strip()):
        cache.delete(otp_key)
        cache.delete(attempts_key)
        return OTP_OK

    try:
        attempts = cache.incr(attempts_key)
    except ValueError:  # key didn't exist yet
        cache.set(attempts_key, 1, OTP_TTL_SECONDS)
        attempts = 1

    if attempts >= MAX_ATTEMPTS:
        cache.delete(otp_key)
        return OTP_LOCKED

    return OTP_INVALID


def send_otp(contact_number: str, code: str) -> None:
    """
    SMS service stub.
    - development: log the code so you can see it in the console (mock send)
    - anything else: no-op for now; plug the real SMS provider in here
    """
    if settings.ENVIRONMENT == "development":
        logger.info("[MOCK SMS] OTP %s -> %s", code, contact_number)
        return

    # TODO: integrate the real SMS provider. Never log the code outside development.
    pass