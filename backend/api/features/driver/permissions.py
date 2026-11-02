from rest_framework.permissions import BasePermission
from ..utils.roles import is_admin, is_driver
from ..utils.security import is_deletion_allowed


class IsDriverOwnerOrAdmin(BasePermission):
    """
    - Admin can read/edit any driver; only TODA admins can delete
    - Driver can read/edit ONLY their own profile (no delete)
    """

    def has_object_permission(self, request, view, obj):
        if is_admin(request.user):
            # [SEC-M10] MDRRMO admins may view but not delete driver accounts
            if request.method == "DELETE":
                return is_deletion_allowed(request.user)
            return True

        if request.method == "DELETE":
            return False

        if is_driver(request.user):
            return obj.pk == request.user.pk

        return False