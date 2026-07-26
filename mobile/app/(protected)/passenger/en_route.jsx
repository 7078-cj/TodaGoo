import { View, Text } from 'react-native'
import React, { useContext } from 'react'
import PassengerContext from '../../../contexts/PassengerContext'
import bookingListener from '../../../listeners/bookingListener'

export default function booking() {
    const {pendingBooking} = useContext(PassengerContext)

    const ws = bookingListener(pendingBooking.id, ()=> console.log("refresh"))
    return (
        <View>
        <Text>en_route</Text>
        </View>
    )
}