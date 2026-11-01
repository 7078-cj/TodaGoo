import hashlib
from django.core.cache import cache
from rest_framework.response import Response

IDEMPOTENCY_TTL = 60 * 5
IDEMPOTENT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class IdempotentAPIView:
    idempotency_ttl = IDEMPOTENCY_TTL
    idempotent_methods = IDEMPOTENT_METHODS

    def _build_cache_key(self, request, idempotency_key):
        # Scope by caller so users can never see each other's cached responses
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        who = hashlib.sha256(auth.encode()).hexdigest()[:16]
        return f"idempotency:{who}:{request.method}:{request.path}:{idempotency_key}"

    def _finalize(self, request, response, *args, **kwargs):
        """Attach the renderer DRF normally sets up inside dispatch()."""
        self.args = args
        self.kwargs = kwargs
        drf_request = self.initialize_request(request, *args, **kwargs)
        self.request = drf_request
        self.headers = self.default_response_headers
        return self.finalize_response(drf_request, response, *args, **kwargs)

    def _replay(self, request, cached, *args, **kwargs):
        response = Response(cached["data"], status=cached["status"])
        response["Idempotent-Replayed"] = "true"
        return self._finalize(request, response, *args, **kwargs)

    def dispatch(self, request, *args, **kwargs):
        if request.method.upper() not in self.idempotent_methods:
            return super().dispatch(request, *args, **kwargs)

        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return super().dispatch(request, *args, **kwargs)

        cache_key = self._build_cache_key(request, idempotency_key)

        cached = cache.get(cache_key)
        if cached is not None and not cached.get("pending"):
            return self._replay(request, cached, *args, **kwargs)

        lock_acquired = cache.add(
            cache_key,
            {"data": None, "status": None, "pending": True},
            self.idempotency_ttl,
        )

        if not lock_acquired:
            cached = cache.get(cache_key)
            if cached and not cached.get("pending"):
                return self._replay(request, cached, *args, **kwargs)
            return self._finalize(
                request,
                Response({"error": "Request already in progress, please wait."}, status=409),
                *args,
                **kwargs,
            )

        try:
            response = super().dispatch(request, *args, **kwargs)
        except Exception:
            cache.delete(cache_key)  # don't leave the lock stuck
            raise

        if 200 <= response.status_code < 300:
            cache.set(
                cache_key,
                {
                    "data": getattr(response, "data", None),
                    "status": response.status_code,
                    "pending": False,
                },
                self.idempotency_ttl,
            )
        else:
            cache.delete(cache_key)  # failures can be retried with the same key

        return response