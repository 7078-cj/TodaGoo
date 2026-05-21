from rest_framework.permissions import BasePermission

class TodaAdminPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'admin')
            and request.user.admin.department == 'TODA'
        )