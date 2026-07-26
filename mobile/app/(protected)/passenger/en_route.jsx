import { View, Text } from 'react-native'
import React, { useContext, useState } from 'react'
import PassengerContext from '../../../contexts/PassengerContext'
import bookingListener from '../../../listeners/bookingListener'

export default function booking() {
    const {pendingBooking} = useContext(PassengerContext)
    const [driverLocation, setDriverLocation] = useState()

    const ws = bookingListener(pendingBooking.id, ()=> console.log("refresh"), setDriverLocation)
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