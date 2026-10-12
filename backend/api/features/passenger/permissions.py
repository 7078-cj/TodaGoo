from rest_framework.permissions import BasePermission
from ..utils.roles import is_passenger, is_admin


class IsPassengerOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            return True

        if is_passenger(request.user):
            return obj.pk == request.user.pk

        return False