from rest_framework.permissions import BasePermission
from ..utils.roles import is_admin, is_driver
from rest_framework import viewsets, permissions


class IsDriverOwnerOrAdmin(BasePermission):
    """
    - Driver can edit ONLY his own profile
    - Admin can edit ANY driver
    """

    def has_object_permission(self, request, view, obj):

        if request.method in permissions.SAFE_METHODS:
            return obj.user == request.user

        if is_admin(request.user):
            return True
        
        if request.method == 'DELETE':
            return is_admin(request.user)

        if is_driver(request.user):
            return obj.user.driver_profile == request.user

        return False