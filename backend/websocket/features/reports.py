import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

VALID_DEPARTMENTS = {"TODA", "MDRRMO"}


class ReportsConsumer(AsyncWebsocketConsumer):

    async def connect(self):

        self.department = self.scope["url_route"]["kwargs"]["department"]

        if self.department not in VALID_DEPARTMENTS:
            await self.close(code=4004)
            return

        self.group_name = f"admin_{self.department}"

        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            await self.close(code=4003)
            return

        is_authorized = await self.check_admin_department(
            user,
            self.department
        )

        if not is_authorized:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "message": "WebSocket connection established"
        }))

    async def disconnect(self, close_code):

        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def incident_report_update(self, event):

        await self.send(text_data=json.dumps({
            "type": "incident_report_update",
            "action": event["action"],
            "report": event["report"],
        }))


    @database_sync_to_async
    def check_admin_department(self, user, department):
        admin = getattr(user, "admin", None)

        return bool(admin and admin.department == department)