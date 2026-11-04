import useWebSocket from "../hooks/useWebsocket";

export default function useNotificationListener(userId, onRefresh, onNotification) {
    const { connected, connectionStatus } = useWebSocket(
        userId ? `ws/notifications/${userId}` : null,
        {
            onRefresh,
            onMessage: (data) => {
                if (data?.type === "notification_update") {
                    // "deleted" carries ids (deleted on another device) instead of one notification
                    onNotification(data.action, data.action === "deleted" ? data.ids : data.notification);
                }
            },
        }
    );

    return { connected, connectionStatus };
}
