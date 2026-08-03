import { View, Text } from 'react-native'
import React, { useContext, useEffect, useRef } from 'react'
import RateUser from '../../../components/RateUser'
import DriverContext from "../../../contexts/DriverContext";

export default function BookingComplete() {
    const { setAcceptedBooking, acceptedBooking } = useContext(DriverContext)

    const bookingRef = useRef(acceptedBooking)

    const booking = bookingRef.current

    const booking_id = booking?.id
    const passenger_user_id = booking?.passenger?.user?.id
    const ratedUserName = booking?.passenger?.user?.username

    useEffect(() => {
        setAcceptedBooking(null)
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
                role="driver"
                bookingId={booking_id}
                ratedUserId={passenger_user_id}
                ratedUserName={ratedUserName}
            />
        </View>
    )
}