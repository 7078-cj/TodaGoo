from django.urls import path
from .views import IncidentReportListCreateView, IncidentReportRetrieveUpdateView

urlpatterns = [
    path("", IncidentReportListCreateView.as_view(), name="incident-report-list-create"),
    path("<int:pk>/", IncidentReportRetrieveUpdateView.as_view(), name="incident-report-retrieve-update"),
]
