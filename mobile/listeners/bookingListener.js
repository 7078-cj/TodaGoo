import useWebSocket from "../hooks/useWebsocket";

function handleBookingMessage(data, setDriverLocation) {
    switch (data.type) {
        case "driver_location":
            setDriverLocation(data.data.coords);
            break;

        default:
            console.log("Unhandled booking message:", data);
    }
}

export default function bookingListener(bookingId, onRefresh, setDriverLocation) {
    const { sendMessage, connected, connectionStatus } = useWebSocket(
        `ws/booking/${bookingId}`,
        {
            onOpen: () => console.log("Connected"),
            onRefresh,
            onClose: () => console.log("Disconnected"),
            onMessage: (data) => {
                handleBookingMessage(data, setDriverLocation)
            }
        }
    )

    return { sendMessage, connected, connectionStatus };
}