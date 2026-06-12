from rest_framework.permissions import BasePermission
from ..utils.roles import is_passenger, is_admin


class IsPassengerOwnerOrAdmin(BasePermission):
    """
    - Passenger can edit only self
    - Admin can edit all passengers
    """

    def has_object_permission(self, request, view, obj):

        if is_admin(request.user):
            return True

        if is_passenger(request.user):
            return obj == request.user

        return False