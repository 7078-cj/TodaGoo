import json
import logging
import time
import uuid

import colorama
from colorama import Fore, Style

colorama.init()


logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = logging.Formatter(fmt="%(asctime)s %(levelname)s; %(message)s ")
handler.formatter = formatter
logger.addHandler(handler)
logger.setLevel(logging.INFO)


SENSITIVE_KEYS = {
    "password",
    "password1",
    "password2",
    "current_password",
    "new_password",
    "confirm_password",
    "token",
    "access",
    "refresh",
    "access_token",
    "refresh_token",
    "secret",
    "otp",
    "pin",
    "authorization",
}

REDACTED = "***REDACTED***"

ID_COLORS = [
    Fore.CYAN,
    Fore.MAGENTA,
    Fore.YELLOW,
    Fore.BLUE,
    Fore.GREEN,
]


def _redact(data):

    if isinstance(data, dict):

        return {
            key: (
                REDACTED
                if key.lower() in SENSITIVE_KEYS
                else _redact(value)
            )
            for key, value in data.items()
        }

    if isinstance(data, list):

        return [_redact(item) for item in data]

    return data


def _safe_parse_json_body(request):

    raw_body = request.body

    if not raw_body:
        return None

    content_type = request.META.get("CONTENT_TYPE", "")

    if "application/json" not in content_type:
        return None

    try:
        return json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None


def _safe_parse_json_response(response):

    if getattr(response, "streaming", False):
        return None

    content_type = response.get("Content-Type", "")

    if "application/json" not in content_type:
        return None

    try:
        return json.loads(response.content.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, AttributeError):
        return None


def _status_color(status_code):

    if status_code >= 500:
        return Fore.RED

    if status_code >= 400:
        return Fore.YELLOW

    if status_code >= 300:
        return Fore.CYAN

    return Fore.GREEN


def _id_color(request_id):
    index = int(request_id, 16) % len(ID_COLORS)

    return ID_COLORS[index]


class LoggingMiddleware:

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        start_time = time.time()

        request_id = uuid.uuid4().hex[:8]

        id_color = _id_color(request_id)

        tag = f"{id_color}[{request_id}]{Style.RESET_ALL}"

        request_body = _safe_parse_json_body(request)

        

        request_data = {
            "method": request.method,
            "ip_address": request.META.get("REMOTE_ADDR"),
            "path": request.path,
        }

        if request_body is not None:
            request_data["body"] = _redact(request_body)

        logger.info(f"{tag} REQUEST  {request_data}")

        response = self.get_response(request)

        duration = time.time() - start_time

        status_color = _status_color(response.status_code)

        response_dict = {
            "status_code": response.status_code,
            "duration": round(duration, 4),
        }

        if response.status_code >= 400:

            error_body = _safe_parse_json_response(response)

            if error_body is not None:
                response_dict["error"] = error_body

        logger.info(f"{tag} RESPONSE {response_dict}")

        return response