import { View, Text } from 'react-native'
import React, { useContext, useEffect, useState } from 'react'
import DriverContext from "../../../contexts/DriverContext";
import bookingListener from "../../../listeners/bookingListener"
import {getLocation} from "../../../utils/location"
import MapComponent from '../../../components/map/MapComponent'

export default function booking() {
    const { acceptedBooking } = useContext(DriverContext)
    const [driverLocation, setDriverLocation] = useState()

    if (!acceptedBooking) {
            return (
                <View>
                    <Text>Loading booking...</Text>
                </View>
            )
        }

    const { sendMessage, 
            connected,
            connectionStatus } 
            = bookingListener(acceptedBooking.id, 
                            () => console.log("refresh"),
                            setDriverLocation)

    useEffect(() => {
        if (!connected) return;

        const interval = setInterval(async () => {
            try {
                const location = await getLocation();

                sendMessage({
                    action: "driver_location",
                    location,
                });
            } catch (err) {
                console.log("Failed to get location:", err);
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [connected]);

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
        <View>
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
                userLocation={true}
            />
            
        </View>
    )
}