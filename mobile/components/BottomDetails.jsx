import { View, Text, TouchableOpacity } from 'react-native'
import React, { useEffect, useState } from 'react'
import { completeBooking, inProgressBooking } from "../api/book"
import { router } from 'expo-router'

export default function BottomDetails({ booking, isDriver = true, onStatusChange }) {
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (booking.status === "completed") {
            if (isDriver) {
                router.replace("/(protected)/driver/complete")
            } else {
                router.replace("/(protected)/passenger/complete")
            }
        }
    }, [booking.status, isDriver])

    const handleInProgress = async () => {
        setLoading(true)
        try {
            const updated = await inProgressBooking(booking.id)
            onStatusChange?.(updated)
        } catch (err) {
            console.error("Failed to mark booking in progress:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleComplete = async () => {
        setLoading(true)
        try {
            const updated = await completeBooking(booking.id)
            onStatusChange?.(updated)
        } catch (err) {
            console.error("Failed to complete booking:", err)
        } finally {
            setLoading(false)
        }
    }

    const handlePress = () => {
        if (loading) return
        if (booking.status === "accepted") {
            handleInProgress()
        } else {
            handleComplete()
        }
    }

    return (
        <View className="h-[40%]">
            <Text>BottomDetails</Text>
            <Text>{booking.status}</Text>

            {isDriver &&
                <TouchableOpacity onPress={handlePress} disabled={loading}>
                    <Text>
                        {loading
                            ? "..."
                            : booking.status === "accepted" ? "Pick Up" : "Complete"}
                    </Text>
                </TouchableOpacity>
            }
        </View>
    )
}