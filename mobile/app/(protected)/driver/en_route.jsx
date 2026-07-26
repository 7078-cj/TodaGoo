import { View, Text } from 'react-native'
import React, { useContext } from 'react'
import DriverContext from "../../../contexts/DriverContext";
import bookingListener from "../../../listeners/bookingListener"

export default function booking() {
    const {acceptedBooking} = useContext(DriverContext)

    const ws = bookingListener(acceptedBooking.id, ()=> console.log("refresh"))
    return (
        <View>
        <Text>en_route</Text>
        </View>
    )
}