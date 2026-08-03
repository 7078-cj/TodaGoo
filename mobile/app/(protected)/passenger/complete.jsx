import { View, Text } from 'react-native'
import React, { useContext, useEffect, useRef } from 'react'
import RateUser from '../../../components/RateUser'
import PassengerContext from '../../../contexts/PassengerContext'
import { Stack, router } from "expo-router";

export default function BookingComplete() {
    const { pendingBooking, setPendingBooking } = useContext(PassengerContext)

    const booking = pendingBooking

    const booking_id = booking?.id
    const driver_user_id = booking?.driver?.id
    const ratedUserName = booking?.driver?.username

    if (!booking) {
        return (
            <View className="flex-1 items-center justify-center">
                <Text>Loading...</Text>
            </View>
        )
    }

    const handleRatingSaved = () => {
        setPendingBooking(null);
        router.replace(`/(protected)/passenger/home`);
    }

    return (
        <View className="flex-1 items-center justify-center">
            <Text>Booking Complete</Text>
            <RateUser
                role="passenger"
                bookingId={booking_id}
                ratedUserId={driver_user_id}
                ratedUserName={ratedUserName}
                handleRatingSaved={handleRatingSaved}
            />
        </View>
    )
}