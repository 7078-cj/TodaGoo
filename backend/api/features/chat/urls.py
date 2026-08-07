from django.urls import path
from .views import MessageListCreateView, MarkMessagesSeenView

urlpatterns = [
    path('', MessageListCreateView.as_view(), name='message'),
    path('seen/', MarkMessagesSeenView.as_view(), name='message-seen'),
]
