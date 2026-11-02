"""
[SEC-H9] Upload limits. Sizes and counts come from settings (MAX_UPLOAD_SIZE_MB,
MAX_EVIDENCE_FILES, MAX_EXCEL_ROWS) so they can be tuned without code changes.
"""
import os
import uuid

from django.conf import settings
from rest_framework import serializers


def max_upload_bytes():
    return settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def validate_file_size(file):
    """Serializer/model validator: reject files over MAX_UPLOAD_SIZE_MB."""
    if file and getattr(file, "size", 0) > max_upload_bytes():
        raise serializers.ValidationError(
            f"File is too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB."
        )
    return file


def validate_file_count(files, limit=None):
    """Reject lists with more than `limit` files (defaults to MAX_EVIDENCE_FILES)."""
    limit = limit or settings.MAX_EVIDENCE_FILES
    if files and len(files) > limit:
        raise serializers.ValidationError(f"You can upload at most {limit} files.")
    return files


def random_filename(filename):
    """Keep the extension, replace the user-supplied name with a UUID."""
    ext = os.path.splitext(filename)[1].lower()[:10]
    return f"{uuid.uuid4().hex}{ext}"


EXCEL_EXTENSIONS = {".xlsx", ".xls"}


def validate_excel_upload(file):
    """Return an error message for a bad Excel upload, or None if it looks fine."""
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in EXCEL_EXTENSIONS:
        return "Only .xlsx or .xls files are allowed."
    if file.size > max_upload_bytes():
        return f"File is too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB."
    return None
