import { View, Text } from 'react-native'
import React, { useContext, useEffect, useState } from 'react'
import PassengerContext from '../../../contexts/PassengerContext'
import bookingListener from '../../../listeners/bookingListener'
import MapComponent from '../../../components/map/MapComponent'
import BottomDetails from '../../../components/BottomDetails'

export default function booking() {
    const { pendingBooking } = useContext(PassengerContext)
    const [driverLocation, setDriverLocation] = useState(null)

    if (!pendingBooking) {
        return (
            <View>
                <Text>Loading booking...</Text>
            </View>
        )
    }

    const ws = bookingListener(pendingBooking.id, () => console.log("refresh"), setDriverLocation)

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
            <Text>en_route</Text>
            <MapComponent
                markers={markers}
                editMode={false}
                userLocation={false}
            />
            <BottomDetails booking={pendingBooking} isDriver={false}/>
        </View>
    )
}