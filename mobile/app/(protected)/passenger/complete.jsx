import { View, Text } from 'react-native'
import React, { useContext } from 'react'
import { useLocalSearchParams } from 'expo-router'
import RateUser from '../../../components/RateUser'
import PassengerContext from '../../../contexts/PassengerContext'

export default function BookingComplete() {
    const { booking_id, driver_user_id } = useLocalSearchParams()
    const { setPendingBooking } = useContext(PassengerContext)

    useEffect(() => {
        setPendingBooking(null)
    }, [])

    return (
        <View>
            <Text>Booking Complete</Text>
            <RateUser
                role="passenger"
                bookingId={booking_id}
                ratedUserId={driver_user_id}
            />
        </View>
    )
}