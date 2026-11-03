import useWebSocket from "../hooks/useWebsocket";

export default function useNotificationListener(userId, onRefresh, onNotification) {
    const { connected, connectionStatus } = useWebSocket(
        userId ? `ws/notifications/${userId}` : null,
        {
            onRefresh,
            onMessage: (data) => {
                if (data?.type === "notification_update") {
                    onNotification(data.action, data.notification);
                }
            },
        }
    );

    return { connected, connectionStatus };
}
