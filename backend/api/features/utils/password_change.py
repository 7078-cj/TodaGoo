"""
Changing the password of a logged-in user.

How the user proves it's really them is pluggable: each verifier checks the request data and
raises ValidationError if it doesn't pass. settings.PASSWORD_CHANGE_VERIFIER picks which one runs
(default "current_password").

To add OTP later: write `verify_otp(user, data)` (e.g. check data["otp"] with utils/otp.py),
register it in VERIFIERS, set PASSWORD_CHANGE_VERIFIER = "otp", and switch the app's
PASSWORD_CHANGE_METHOD (mobile/constants/passwordChange.js) to match.
"""
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError

from .security import blacklist_user_tokens


def verify_current_password(user, data):
    current = data.get("current_password")
    if not current or not user.check_password(current):
        raise ValidationError({"current_password": "Current password is incorrect."})


VERIFIERS = {
    "current_password": verify_current_password,
}


def get_verifier():
    name = getattr(settings, "PASSWORD_CHANGE_VERIFIER", "current_password")
    return VERIFIERS[name]


def change_password(user, data):
    """
    Verify the user, validate `new_password`, save it and sign out every other session.
    Raises ValidationError with field errors on failure.
    """
    get_verifier()(user, data)

    new_password = data.get("new_password")
    if not new_password:
        raise ValidationError({"new_password": "New password is required."})
    if user.check_password(new_password):
        raise ValidationError({"new_password": "New password must be different from the current one."})

    try:
        validate_password(new_password, user)
    except DjangoValidationError as exc:
        raise ValidationError({"new_password": list(exc.messages)})

    user.set_password(new_password)
    user.save(update_fields=["password"])
    # [SEC-M13] every existing session (refresh token) stops working
    blacklist_user_tokens(user)
