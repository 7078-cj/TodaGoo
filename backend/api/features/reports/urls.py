from django.urls import path
from .views import IncidentReportListCreateView, IncidentReportRetrieveUpdateView, IncidentReportAboutMeView

urlpatterns = [
    path("", IncidentReportListCreateView.as_view(), name="incident-report-list-create"),
    path("<int:pk>/", IncidentReportRetrieveUpdateView.as_view(), name="incident-report-retrieve-update"),
    path("<int:pk>/about-me/", IncidentReportAboutMeView.as_view(), name="incident-report-about-me"),
]
