import useWebSocket from "../hooks/useWebsocket";

function handleDriverMessage(data, setPendingBooking, setAcceptedBooking) {
    switch (data.type) {
        case "new_booking":
            setPendingBooking(data.data);
            break;

        case "accept_booking":
            setPendingBooking(null)
            setAcceptedBooking(data.data)
            break

        case "decline_booking":
            if (data.success) {
                setPendingBooking(null);
            }
            break;

        default:
            console.log("Unhandled driver message:", data);
    }
}

export default function driverListener(userId, onRefresh,  setPendingBooking, setAcceptedBooking ) {
    const { sendMessage, connected, connectionStatus } = useWebSocket(
        `ws/driver/${userId}`,
        {
            onOpen: () => console.log("Connected"),
            onRefresh,
            onClose: () => console.log("Disconnected"),
            onMessage: (data) => handleDriverMessage(data, setPendingBooking, setAcceptedBooking ),
        }
    );

    const acceptBooking = (bookingId) => {
        sendMessage({
            action: "accept_booking",
            booking_id: bookingId,
        });
    };

    const declineBooking = (bookingId, location) => {
        sendMessage({
            action: "decline_booking",
            booking_id: bookingId,
            location: {
                latitude: location.latitude,
                longitude: location.longitude,
            },
        });
    };

    return { acceptBooking, declineBooking, connected, connectionStatus };
}