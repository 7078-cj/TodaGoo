import { View, Text } from 'react-native'
import React, { useState } from 'react'
import { router } from 'expo-router'
import PageHeader from './layouts/PageHeader'
import RideReceiptScreen from './RideReceiptScreen'
import RateUser from './RateUser'
import { LoadingScreen } from './loading';
import { LOADING_MESSAGES } from '../constants/loading';
import { getPerson } from '../utils/person'
import colors from '../constants/colors'

// Completed ride: receipt first, then rate the other person (driver ↔ passenger), then home.
// role: who is looking ("driver" | "passenger"); onFinish clears the finished booking from context.
export default function RideCompleteFlow({ booking, role, onFinish }) {
    const [step, setStep] = useState("receipt")
    const isDriver = role === "driver"

    if (!booking) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                <PageHeader title="Ride Completed" />
                <LoadingScreen message={LOADING_MESSAGES.booking} />
            </View>
        )
    }

    const person = getPerson(booking, isDriver) // the other party
    const ratedUserId = isDriver ? booking.passenger?.id : booking.driver?.id

    const finish = () => {
        onFinish?.()
        router.replace(`/(protected)/${role}/home`)
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {step === "receipt" ? (
                <>
                    <PageHeader title="Ride Completed" onBack={finish} />
                    <RideReceiptScreen booking={booking} role={role} onRate={() => setStep("rate")} />
                </>
            ) : (
                <>
                    <PageHeader title={isDriver ? "Rate Passenger" : "Rate Driver"} onBack={() => setStep("receipt")} />
                    {ratedUserId ? (
                        <RateUser bookingId={booking.id} ratedUserId={ratedUserId} person={person} onDone={finish} />
                    ) : (
                        <Text style={{ padding: 24, color: "#6B7280" }}>{"There's no one to rate for this ride."}</Text>
                    )}
                </>
            )}
        </View>
    )
}
