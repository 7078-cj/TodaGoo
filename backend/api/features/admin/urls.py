from django.urls import path
from .views import (TodaStationListCreateAPIView, 
TODAListCreateAPIView, 
TodaStationRetrieveUpdateDestroyAPIView, 
TODARetrieveUpdateDestroyAPIView,
TodaStationListCreateView,
TodaStationRetrieveUpdateDestroyView)
urlpatterns = [
    # Add your paths here
    path('toda-boundary/', TodaStationListCreateAPIView.as_view(), name='toda-boundary-list-create'),
    path('toda-boundary/<int:pk>/', TodaStationRetrieveUpdateDestroyAPIView.as_view(), name='toda-boundary-detail'),
    path('todas/', TODAListCreateAPIView.as_view(), name='toda-list'),
    path('todas/<int:pk>/', TODARetrieveUpdateDestroyAPIView.as_view(), name='toda-detail'),
    path('toda-stations/', TodaStationListCreateView.as_view(), name='toda-station-list-create'),
    path('toda-stations/<int:pk>/', TodaStationRetrieveUpdateDestroyView.as_view(), name='toda-station-detail'),

]
