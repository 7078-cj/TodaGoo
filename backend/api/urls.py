from django.urls import path, include


urlpatterns = [
     path('user/', include('api.features.user.urls')),
     path('passenger/', include('api.features.passenger.urls')),
     path('driver/', include('api.features.driver.urls')),
     path('booking/', include('api.features.booking.urls')),
     path('reports/', include('api.features.reports.urls')),
]