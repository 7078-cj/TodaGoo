import { Alert } from "react-native";
import useWebSocket from "../hooks/useWebsocket";
import { isAppInForeground, showBookingOffer } from "../background";

function handleDriverMessage(data, setPendingBooking, setAcceptedBooking) {
    switch (data.type) {
        case "new_booking":
            setPendingBooking(data.data);
            // app minimized: a phone notification, so the offer isn't missed before it expires
            if (!isAppInForeground()) showBookingOffer(data.data);
            break;

        case "accept_booking":
            setPendingBooking(null)
            // a failed accept replies { success: false, message } (offer expired / already taken):
            // that isn't a booking, so don't treat it as the accepted ride
            if (data.data?.id) setAcceptedBooking(data.data)
            else Alert.alert("Booking unavailable", data.data?.message ?? "This booking is no longer available.")
            break

        // the server ended the offer (30 s timeout): close it if it's the one on screen
        case "offer_expired":
            setPendingBooking((current) =>
                current && String(current.id) === String(data.data?.booking_id) ? null : current
            )
            break

        case "decline_booking":
            if (data.success) {
                setPendingBooking(null);
            }
            break;
        
        case "booking_update":
            setAcceptedBooking(data.data)
            break

        default:
            console.log("Unhandled driver message:", data);
    }
}

export default function useDriverListener(userId, onRefresh,  setPendingBooking, setAcceptedBooking ) {
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