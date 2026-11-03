import { View, Text } from 'react-native'
import React, { useContext, useEffect, useState } from 'react'
import PassengerContext from '../../../contexts/PassengerContext'
import bookingListener from '../../../listeners/bookingListener'
import MapComponent from '../../../components/map/MapComponent'
import BottomDetails from '../../../components/BottomDetails'
import ChatModal from '../../../components/chat/ChatModal'
import useChatPresence from '../../../hooks/useChatPresence'
import useOpenChatParam from '../../../hooks/useOpenChatParam'

export default function booking() {
    const { pendingBooking } = useContext(PassengerContext)
    const [driverLocation, setDriverLocation] = useState(null)
    const [chatVisible, setChatVisible] = useState(false)
    const [messages, setMessages] = useState([])

    const ws = bookingListener(
        pendingBooking?.id,
        () => console.log("refresh"), 
        setDriverLocation,
        setMessages
    )

    useChatPresence(ws.sendMessage, ws.connected, chatVisible)
    // a tapped message notification opens the chat (see constants/notificationRedirects.js)
    const closeChat = useOpenChatParam(pendingBooking?.id, setChatVisible)

    if (!pendingBooking) {
        return (
            <View>
                <Text>Loading booking...</Text>
            </View>
        )
    }

    const markers = [
        {
            id: "start",
            lat: pendingBooking.start.lat,
            lng: pendingBooking.start.lng,
            full: pendingBooking.start_address,
        },
        ...pendingBooking.stops.map((stop) => ({
            id: `stop-${stop.id}`,
            lat: stop.location.lat,
            lng: stop.location.lng,
            full: stop.address,
        })),
        {
            id: "end",
            lat: pendingBooking.end.lat,
            lng: pendingBooking.end.lng,
            full: pendingBooking.end_address,
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
                route={pendingBooking.routes}
                isRoute={false}
            />
            <BottomDetails booking={pendingBooking} isDriver={false} setChatVisible={setChatVisible}/>
            <ChatModal
                visible={chatVisible}
                onClose={closeChat}
                bookingId={pendingBooking?.id}
                currentUserId={pendingBooking?.passenger?.id}
                messages={messages}
                setMessages={setMessages}
            />
        </View>
    )
}