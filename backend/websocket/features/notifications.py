from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from websocket.auth import SubprotocolAcceptMixin
import json
from api.features.user.utils import notification_group

class NotificationConsumer(SubprotocolAcceptMixin, AsyncWebsocketConsumer):  # [SEC-H8]
    async def connect(self):
        self.user_id = self.scope["url_route"]["kwargs"]["user_id"]
        # its own group, not user_<id> (ride events go there; see notification_group)
        self.group_name = notification_group(self.user_id)

        user = self.scope.get("user")
        if not user or not user.is_authenticated or str(user.id) != str(self.user_id):
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_update(self, event):
        await self.send(text_data=json.dumps(event))