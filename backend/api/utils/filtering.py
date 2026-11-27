from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError


def apply_date_range_filter(queryset, params, date_field="created_at__date"):
    date_from = params.get("date_from")
    date_to = params.get("date_to")

    if date_from:
        parsed_from = parse_date(date_from)
        if parsed_from is None:
            raise ValidationError({"date_from": "Must be in YYYY-MM-DD format."})
        queryset = queryset.filter(**{f"{date_field}__gte": parsed_from})

    if date_to:
        parsed_to = parse_date(date_to)
        if parsed_to is None:
            raise ValidationError({"date_to": "Must be in YYYY-MM-DD format."})
        queryset = queryset.filter(**{f"{date_field}__lte": parsed_to})

    return queryset


def apply_rating_filter(queryset, params, rating_field):
    min_rating = params.get("min_rating")
    if min_rating:
        try:
            min_rating = float(min_rating)
        except (TypeError, ValueError):
            raise ValidationError({"min_rating": "Must be a number."})
        queryset = queryset.filter(**{f"{rating_field}__gte": min_rating})

    max_rating = params.get("max_rating")
    if max_rating:
        try:
            max_rating = float(max_rating)
        except (TypeError, ValueError):
            raise ValidationError({"max_rating": "Must be a number."})
        queryset = queryset.filter(**{f"{rating_field}__lte": max_rating})

    return queryset


def apply_user_search_filter(queryset, search):
    if not search:
        return queryset
    return queryset.filter(
        Q(username__icontains=search)
        | Q(first_name__icontains=search)
        | Q(last_name__icontains=search)
    )
