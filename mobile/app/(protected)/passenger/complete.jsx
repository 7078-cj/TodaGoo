import { View, Text } from 'react-native'
import React, { useContext, useEffect, useRef } from 'react'
import RateUser from '../../../components/RateUser'
import PassengerContext from '../../../contexts/PassengerContext'

export default function BookingComplete() {
    const { setPendingBooking, pendingBooking } = useContext(PassengerContext)

    const bookingRef = useRef(pendingBooking)

    const booking = bookingRef.current

    const booking_id = booking?.id
    const driver_user_id = booking?.driver?.user?.id
    const ratedUserName = booking?.driver?.user?.username

    useEffect(() => {
        setPendingBooking(null)
    }, [])

    if (!booking) {
        return (
            <View>
                <Text>Loading...</Text>
            </View>
        )
    }

    return (
        <View>
            <Text>Booking Complete</Text>
            <RateUser
                role="passenger"
                bookingId={booking_id}
                ratedUserId={driver_user_id}
                ratedUserName={ratedUserName}
            />
        </View>
    )
}