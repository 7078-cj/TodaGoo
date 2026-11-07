import useWebSocket from "../hooks/useWebsocket";
import { setReadyDrivers } from "../utils/driverAvailabilityStore";

function handlePassengerMessage(data, setPendingBooking, setBookingUnavailable) {
    switch (data.type) {
        case "booking_accepted":
            setPendingBooking(data.data);
            break;

        case "booking_updated":
            setPendingBooking(data.data);
            break;

        // no driver took the booking (none queued / outside a TODA area ...): { booking_id, message }
        case "booking_unavailable":
            setBookingUnavailable?.(data.data);
            break;

        case "driver_availability":
            setReadyDrivers(data.data.ready_drivers);
            break;

        // handled by NotificationContext over ws/notifications
        case "notification_update":
            break;

        default:
            console.log("Unhandled passenger message:", data);
    }
}

export default function usePassengerListener(userId, onRefresh, setPendingBooking, setBookingUnavailable){
    const  { sendMessage, connected, connectionStatus } = useWebSocket(
        `ws/passenger/${userId}`,
        {
            onOpen: () => console.log("Connected"),
            onRefresh,
            onClose: () => console.log("Disconnected"),
            onMessage: (data) => {
                handlePassengerMessage(data, setPendingBooking, setBookingUnavailable)
            }
        }
    )

    return { connected, connectionStatus };
}