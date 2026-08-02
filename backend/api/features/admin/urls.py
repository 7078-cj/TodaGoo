from django.urls import path
from .views import (TodaBoundariesListCreateAPIView, 
TODAListCreateAPIView, 
TodaBoundariesRetrieveUpdateDestroyAPIView, 
TODARetrieveUpdateDestroyAPIView,
TodaStationListCreateView,
TodaStationRetrieveUpdateDestroyView,
get_toda_stations_with_prefix)
urlpatterns = [
    # Add your paths here
    path('toda-boundary/', TodaBoundariesListCreateAPIView.as_view(), name='toda-boundary-list-create'),
    path('toda-boundary/<int:pk>/', TodaBoundariesRetrieveUpdateDestroyAPIView.as_view(), name='toda-boundary-detail'),
    path('todas/', TODAListCreateAPIView.as_view(), name='toda-list'),
    path('todas/<int:pk>/', TODARetrieveUpdateDestroyAPIView.as_view(), name='toda-detail'),
    path('toda-stations/', TodaStationListCreateView.as_view(), name='toda-station-list-create'),
    path('toda-stations/<int:pk>/', TodaStationRetrieveUpdateDestroyView.as_view(), name='toda-station-detail'),
    path('toda-station-prefix/', get_toda_stations_with_prefix, name='toda-station-prefix'),

]
