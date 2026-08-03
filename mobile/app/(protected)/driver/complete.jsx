import { View, Text } from 'react-native'
import React, { useContext, useEffect, useRef } from 'react'
import RateUser from '../../../components/RateUser'
import DriverContext from "../../../contexts/DriverContext";
import { Stack, router } from "expo-router";

export default function BookingComplete() {
    const { acceptedBooking, setAcceptedBooking } = useContext(DriverContext)

    const booking = acceptedBooking

    const booking_id = booking?.id
    const passenger_user_id = booking?.passenger?.id
    const ratedUserName = booking?.passenger?.username

    if (!booking) {
        return (
            <View>
                <Text>Loading...</Text>
            </View>
        )
    }

    const handleRatingSaved = () => {
        setAcceptedBooking(null);
        router.replace(`/(protected)/driver/home`);
    }

    return (
        <View className="flex-1 items-center justify-center">
            <Text>Booking Complete</Text>
            <RateUser
                role="driver"
                bookingId={booking_id}
                ratedUserId={passenger_user_id}
                ratedUserName={ratedUserName}
                handleRatingSaved={handleRatingSaved}
            />
        </View>
    )
}