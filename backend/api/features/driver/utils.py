import re
import numpy as np
from PIL import Image
import io


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