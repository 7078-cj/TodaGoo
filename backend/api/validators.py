# validators.py
import re
from django.core.exceptions import ValidationError


class ComplexPasswordValidator:
    """
    Validates that a password contains at least:
    - 1 uppercase letter
    - 1 numeric digit
    - 1 special character (symbol)
    """

    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                "Password must contain at least 1 uppercase letter.",
                code='password_no_upper',
            )
        if not re.search(r'[0-9]', password):
            raise ValidationError(
                "Password must contain at least 1 number.",
                code='password_no_number',
            )
        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\];\'`~/\\]', password):
            raise ValidationError(
                "Password must contain at least 1 special character.",
                code='password_no_symbol',
            )

    def get_help_text(self):
        return (
            "Your password must contain at least 1 uppercase letter, "
            "1 number, and 1 special character."
        )