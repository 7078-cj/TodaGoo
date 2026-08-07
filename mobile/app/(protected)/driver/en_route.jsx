import { View, Text } from 'react-native'
import React, { useContext, useEffect, useState } from 'react'
import DriverContext from "../../../contexts/DriverContext";
import bookingListener from "../../../listeners/bookingListener"
import { getLocation } from "../../../utils/location"
import MapComponent from '../../../components/map/MapComponent'
import BottomDetails from '../../../components/BottomDetails';

const broadcastDriverLocation = async (sendMessage) => {
    try {
        const location = await getLocation();

        sendMessage({
            action: "driver_location",
            location,
        });
    } catch (err) {
        console.log("Failed to get location:", err);
    }
}

export default function booking() {
    const { acceptedBooking } = useContext(DriverContext)
    const [driverLocation, setDriverLocation] = useState()
    const [messages, setMessages] = useState()

    const { sendMessage, connected, connectionStatus } =
        bookingListener(
            acceptedBooking?.id,
            () => console.log("refresh"),
            setDriverLocation,
            setMessages
        )

    broadcastDriverLocation(sendMessage)

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
            <Text>en_route</Text>
            {
                driverLocation && <>
                    <Text>{driverLocation.latitude}</Text>
                    <Text>{driverLocation.latitude}</Text>
                </>
            }
            <MapComponent
                markers={markers}
                editMode={false}
                userLocation={false}
                route={acceptedBooking.routes}
                isRoute={false}

            />
            <BottomDetails booking={acceptedBooking} />
        </View>
    )
}