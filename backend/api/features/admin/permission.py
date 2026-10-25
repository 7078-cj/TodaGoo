from rest_framework.permissions import BasePermission
from ..utils.roles import is_admin, is_toda_admin


class IsAdminProfile(BasePermission):
    """Allows only authenticated users who have an Admin profile."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and is_admin(user))


class TodaAdminPermission(BasePermission):
    def has_permission(self, request, view):
        return is_toda_admin(request.user)

    def has_object_permission(self, request, view, obj):
        return is_toda_admin(request.user)