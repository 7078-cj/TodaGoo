import { View, Text, TouchableOpacity } from 'react-native'
import React, { useEffect, useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { completeBooking, inProgressBooking } from "../api/book"
import { router } from 'expo-router'

export default function BottomDetails({ booking, isDriver = true, onStatusChange }) {
    const [loading, setLoading] = useState(false)

    const inProgressKeyRef = useRef(null)
    const completeKeyRef = useRef(null)

    const handleInProgress = async () => {
        if (!inProgressKeyRef.current) {
            inProgressKeyRef.current = uuidv4()
        }

        setLoading(true)
        try {
            const updated = await inProgressBooking(booking.id, inProgressKeyRef.current)
            onStatusChange?.(updated)
            inProgressKeyRef.current = null
        } catch (err) {
            console.error("Failed to mark booking in progress:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleComplete = async () => {
        if (!completeKeyRef.current) {
            completeKeyRef.current = uuidv4()
        }

        setLoading(true)
        try {
            const updated = await completeBooking(booking.id, completeKeyRef.current)
            onStatusChange?.(updated)
            completeKeyRef.current = null
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
        } else if (booking.status === "in_progress") {
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