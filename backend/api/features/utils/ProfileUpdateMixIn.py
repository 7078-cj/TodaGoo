from rest_framework.response import Response
from ..utils.reconstruction import reconstruct_nested
from rest_framework import status
from django.core.cache import cache

class ProfileUpdateMixin:
    profile_prefix = None          # "driver_profile." / "passenger_profile."
    cache_prefix = None            # "driver_profile" / "passenger_profile"
    admin_serializer_class = None  # status-only serializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()  # runs object-level permissions
        cache_key = f"{self.cache_prefix}:{instance.pk}"

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        data = self.get_serializer(instance).data
        cache.set(cache_key, data, 60 * 30)
        return Response(data)

    def _is_toda_admin(self, user):
        admin = getattr(user, "admin", None)
        return admin is not None and admin.department == "TODA"

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        if request.user.id == instance.id:
            serializer_class = self.serializer_class

        elif self._is_toda_admin(request.user):
            serializer = self.admin_serializer_class(
            self.get_profile(instance),
            data=data.get(self.profile_key, {}),
            partial=partial,
            context=self.get_serializer_context(),
        )
        else:
            return Response(
                {"detail": "You do not have permission to update this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = reconstruct_nested(request.data, prefix=self.profile_prefix)
        serializer = serializer_class(
            instance, data=data, partial=partial,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        cache.delete(f"{self.cache_prefix}:{instance.pk}")

        # Always respond with the full read serializer
        return Response(
            self.serializer_class(instance, context=self.get_serializer_context()).data
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        pk = instance.pk
        response = super().destroy(request, *args, **kwargs)
        cache.delete(f"{self.cache_prefix}:{pk}")
        return response