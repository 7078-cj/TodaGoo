from rest_framework.permissions import BasePermission
from ..utils.roles import is_admin


class IsAdminProfile(BasePermission):
    """Allows only authenticated users who have an Admin profile."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and is_admin(user))