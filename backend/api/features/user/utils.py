import secrets
from django.conf import settings
from django.core.mail import send_mail



def generate_pin():
    # [SEC-C2] secure 6-digit code; password reset now uses utils/password_reset.py
    return f"{secrets.randbelow(10**6):06d}"

def send_reset_email(user, code):
    send_mail(
        "Password Reset Code",
        f"Your password reset code is: {code}",
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
    )