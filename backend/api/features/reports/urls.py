from django.urls import path
from .views import IncidentReportListCreateView, IncidentReportRetrieveUpdateView

urlpatterns = [
    path("incident-reports/", IncidentReportListCreateView.as_view(), name="incident-report-list-create"),
    path("incident-reports/<int:pk>/", IncidentReportRetrieveUpdateView.as_view(), name="incident-report-retrieve-update"),
]
