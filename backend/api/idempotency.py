from functools import wraps
from django.core.cache import cache
from rest_framework.response import Response

IDEMPOTENCY_TTL = 60 * 5
IDEMPOTENT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

class IdempotentAPIView:
    idempotency_ttl = IDEMPOTENCY_TTL
    idempotent_methods = IDEMPOTENT_METHODS

    def dispatch(self, request, *args, **kwargs):
        if request.method.upper() not in self.idempotent_methods:
            return super().dispatch(request, *args, **kwargs)

        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return super().dispatch(request, *args, **kwargs)

        cache_key = f"idempotency:{request.path}:{idempotency_key}"

        cached = cache.get(cache_key)
        if cached is not None and not cached.get("pending"):
            return Response(cached["data"], status=cached["status"])

        lock_acquired = cache.add(cache_key, {"data": None, "status": None, "pending": True}, self.idempotency_ttl)

        if not lock_acquired:
            cached = cache.get(cache_key)
            if cached and not cached.get("pending"):
                return Response(cached["data"], status=cached["status"])
            return Response({"error": "Request already in progress, please wait."}, status=409)

        response = super().dispatch(request, *args, **kwargs)

        cache.set(
            cache_key,
            {"data": response.data, "status": response.status_code, "pending": False},
            self.idempotency_ttl,
        )

        return response