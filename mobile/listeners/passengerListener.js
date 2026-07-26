import useWebSocket from "../hooks/useWebsocket";

function handlePassengerMessage(data, setPendingBooking) {
    console.log(data)
    switch (data.type) {
        case "booking_accepted":
            setPendingBooking(data.data);
            break;

        default:
            console.log("Unhandled passenger message:", data);
    }
}

export default function passengerListener(userId, onRefresh, setPendingBooking){
    const  { sendMessage, connected, connectionStatus } = useWebSocket(
        `ws/passenger/${userId}`,
        {
            onOpen: () => console.log("Connected"),
            onRefresh,
            onClose: () => console.log("Disconnected"),
            onMessage: (data) => {
                handlePassengerMessage(data, setPendingBooking)
            }
        }
    )

    return {}
}