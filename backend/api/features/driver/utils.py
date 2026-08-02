import easyocr
import re
import numpy as np
from PIL import Image
import io
import threading

_reader = None
_reader_lock = threading.Lock()


def _get_reader():
    global _reader
    if _reader is None:
        with _reader_lock:
            if _reader is None: 
                _reader = easyocr.Reader(['en'], gpu=False)
    return _reader


def verify_license_details(image_file, first_name, last_name, license_number):
    """
    Runs OCR on a license image and checks whether the given first_name,
    last_name, and license_number appear in the extracted text.
    """
    image_input = _normalize_image_input(image_file)

    reader = _get_reader()
    results = reader.readtext(image_input, detail=0)
    raw_text = " ".join(results)

    normalized_text = re.sub(r'[^A-Z0-9\s]', '', raw_text.upper())

    def normalize(value):
        return re.sub(r'[^A-Z0-9\s]', '', str(value).upper()).strip()

    def is_present(value):
        value_norm = normalize(value)
        if not value_norm:
            return False
        return value_norm in normalized_text

    matched_fields = {
        "first_name": is_present(first_name),
        "last_name": is_present(last_name),
        "license_number": is_present(license_number),
    }

    return {
        "match": all(matched_fields.values()),
        "matched_fields": matched_fields,
        "raw_text": raw_text,
    }


def _normalize_image_input(image_file):
    if hasattr(image_file, "read"):
        image_file.seek(0)
        image_bytes = image_file.read()
        image_file.seek(0)
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return np.array(pil_image)

    if isinstance(image_file, (bytes, bytearray)):
        pil_image = Image.open(io.BytesIO(image_file)).convert("RGB")
        return np.array(pil_image)

    return image_file