from rest_framework.permissions import BasePermission
from ..utils.roles import is_passenger, is_admin
from ..utils.security import is_deletion_allowed


class IsPassengerOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            # [SEC-M10] MDRRMO admins may view but not delete passenger accounts
            if request.method == "DELETE":
                return is_deletion_allowed(request.user)
            return True

        if is_passenger(request.user):
            return obj.pk == request.user.pk

        return False