from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

channel_layer = get_channel_layer()

def broadcast(channel, type, data):
    async_to_sync(channel_layer.group_send)(
        channel,
        {
            "type":type,
            "data":data
        }
    )