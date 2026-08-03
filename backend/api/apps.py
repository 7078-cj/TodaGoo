from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import api.features.booking.signals
        import api.features.admin.signals
        import api.features.passenger.signals
        import api.features.driver.signals
        import api.features.reports.signals
        import api.features.chat.signals
