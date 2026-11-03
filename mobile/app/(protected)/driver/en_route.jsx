import { View, Text } from 'react-native'
import React, { useContext, useEffect, useState } from 'react'
import DriverContext from "../../../contexts/DriverContext";
import bookingListener from "../../../listeners/bookingListener"
import { getLocation } from "../../../utils/location"
import MapComponent from '../../../components/map/MapComponent'
import BottomDetails from '../../../components/BottomDetails';
import ChatModal from '../../../components/chat/ChatModal';
import useChatPresence from '../../../hooks/useChatPresence';
import useOpenChatParam from '../../../hooks/useOpenChatParam';

const broadcastDriverLocation = async (sendMessage) => {
    try {
        const location = await getLocation();
        if (!location) return;

        sendMessage({
            action: "driver_location",
            location,
        });
    } catch (err) {
        console.log("Failed to get location:", err);
    }
}

export default function booking() {
    const { acceptedBooking, setAcceptedBooking } = useContext(DriverContext)
    const [driverLocation, setDriverLocation] = useState()
    const [chatVisible, setChatVisible] = useState(false)
    const [messages, setMessages] = useState([])

    const { sendMessage, connected, connectionStatus } =
        bookingListener(
            acceptedBooking?.id,
            () => console.log("refresh"),
            setDriverLocation,
            setMessages
        )

    useChatPresence(sendMessage, connected, chatVisible)
    // a tapped message notification opens the chat (see constants/notificationRedirects.js)
    const closeChat = useOpenChatParam(acceptedBooking?.id, setChatVisible)

    useEffect(() => {
        broadcastDriverLocation(sendMessage);
    }, []);

    useEffect(() => {
        if (!connected) return;

        const interval = setInterval(async () => {
            broadcastDriverLocation(sendMessage);
        }, 10000);

        return () => clearInterval(interval);
    }, [connected]);

    if (!acceptedBooking) {
        return (
            <View>
                <Text>Loading booking...</Text>
            </View>
        )
    }

    const markers = [
        {
            id: "start",
            lat: acceptedBooking.start.lat,
            lng: acceptedBooking.start.lng,
            full: acceptedBooking.start_address,
        },
        ...acceptedBooking.stops.map((stop) => ({
            id: `stop-${stop.id}`,
            lat: stop.location.lat,
            lng: stop.location.lng,
            full: stop.address,
        })),
        {
            id: "end",
            lat: acceptedBooking.end.lat,
            lng: acceptedBooking.end.lng,
            full: acceptedBooking.end_address,
        },
        ...(driverLocation
            ? [{
                id: "driver",
                lat: driverLocation.latitude,
                lng: driverLocation.longitude,
                type: "driver",
                full: "Driver",
                }]
            : []),
    ];

    return (
        <View className="flex-1">
            <MapComponent
                markers={markers}
                editMode={false}
                userLocation={false}
                route={acceptedBooking.routes}
                isRoute={false}

            />
            <BottomDetails
                booking={acceptedBooking}
                setChatVisible={setChatVisible}
                driverLocation={driverLocation}
                onStatusChange={setAcceptedBooking}
            />
            <ChatModal
                visible={chatVisible}
                onClose={closeChat}
                bookingId={acceptedBooking?.id}
                currentUserId={acceptedBooking?.driver?.id}
                messages={messages}
                setMessages={setMessages}
            />
        </View>
    )
}