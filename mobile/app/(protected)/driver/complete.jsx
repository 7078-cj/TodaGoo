import { View, Text } from 'react-native'
import React, { useContext } from 'react'
import { useLocalSearchParams } from 'expo-router'
import RateUser from '../../../components/RateUser'
import DriverContext from "../../../contexts/DriverContext";

export default function BookingComplete() {
    const { booking_id, passenger_user_id } = useLocalSearchParams()
    const {setAcceptedBooking} = useContext(DriverContext)

    useEffect(()=>{
        setAcceptedBooking(null)
    },[])

    return (
        <View>
            <Text>Booking Complete</Text>
            <RateUser
                role="driver"
                bookingId={booking_id}
                ratedUserId={passenger_user_id}
            />
        </View>
    )
}