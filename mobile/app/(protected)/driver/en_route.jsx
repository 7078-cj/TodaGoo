import { View, Text } from 'react-native'
import React, { useContext, useEffect, useState } from 'react'
import DriverContext from "../../../contexts/DriverContext";
import bookingListener from "../../../listeners/bookingListener"
import {getLocation} from "../../../utils/location"

export default function booking() {
    const { acceptedBooking } = useContext(DriverContext)
    const [driverLocation, setDriverLocation] = useState()

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

    return (
        <View>
            <Text>en_route</Text>
            {
                driverLocation && <>
                    <Text>{driverLocation.latitude}</Text>
                    <Text>{driverLocation.latitude}</Text>
                </>
            }
            
        </View>
    )
}