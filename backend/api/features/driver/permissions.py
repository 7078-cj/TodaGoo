from rest_framework.permissions import BasePermission
from ..utils.roles import is_admin, is_driver
from rest_framework import viewsets, permissions


class IsDriverOwnerOrAdmin(BasePermission):
    """
    - Admin can read/edit/delete any driver
    - Driver can read/edit ONLY their own profile (no delete)
    """

    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            return True

        if request.method == "DELETE":
            return False

        if is_driver(request.user):
            return obj.pk == request.user.pk

        return False