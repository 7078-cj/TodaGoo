from django.urls import path
from .views import TodaStationListCreateAPIView, TODAListCreateAPIView, TodaStationRetrieveUpdateDestroyAPIView
urlpatterns = [
    # Add your paths here
    path('toda-stations/', TodaStationListCreateAPIView.as_view(), name='toda-station-list-create'),
    path('toda-stations/<int:pk>/', TodaStationRetrieveUpdateDestroyAPIView.as_view(), name='toda-station-detail'),
    path('todas/', TODAListCreateAPIView.as_view(), name='toda-list'),
]
