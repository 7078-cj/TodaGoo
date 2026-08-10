import useWebSocket from "../hooks/useWebsocket";

function handleBookingMessage(data, setDriverLocation, setMessages) {
    switch (data.type) {
        case "driver_location":
            console.log(data)
            setDriverLocation(data.data.coords);
            break;

        case "chat_message":
            setMessages((prev) => [...(prev ?? []), data.data]);
            break;

        case "messages_seen": {
            const seenIds = new Set(data.data);
            setMessages((prev) =>
                (prev ?? []).map((msg) =>
                    seenIds.has(msg.id) ? { ...msg, seen: true } : msg
                )
            );
            break;
        }

        default:
            console.log("Unhandled booking message:", data);
    }
}

export default function bookingListener(bookingId, onRefresh, setDriverLocation, setMessages) {
    const { sendMessage, connected, connectionStatus } = useWebSocket(
        `ws/booking/${bookingId}`,
        {
            onOpen: () => console.log("Connected"),
            onRefresh,
            onClose: () => console.log("Disconnected"),
            onMessage: (data) => {
                handleBookingMessage(data, setDriverLocation, setMessages);
            },
        }
    );

    return { sendMessage, connected, connectionStatus };
}