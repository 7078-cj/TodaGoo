import json
from channels.generic.websocket import AsyncWebsocketConsumer
from websocket.auth import SubprotocolAcceptMixin
from channels.db import database_sync_to_async

class MyWebSocketConsumer(SubprotocolAcceptMixin, AsyncWebsocketConsumer):  # [SEC-H8]
    async def connect(self):
        self.id = self.scope['url_route']['kwargs']['id']

        user = self.scope.get('user')
        
        if not user or not user.is_authenticated or str(user.id) != str(self.id):
            await self.close(code=4003)
            return

        # [SEC-M14] join the group only after the user check passes
        await self.channel_layer.group_add(
            f'group_{self.id}',
            self.channel_name
        )
        
        #a
        
        await self.accept()
        await self.send(text_data=json.dumps({
            'message': 'WebSocket connection established'
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            f'group_{self.id}',
            self.channel_name
        )
        
        await self.close()

    