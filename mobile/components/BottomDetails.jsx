import { View, Text, TouchableOpacity } from 'react-native'
import React, { useEffect, useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Ionicons } from '@expo/vector-icons'
import { completeBooking, inProgressBooking } from "../api/book"
import { router } from 'expo-router'
import IncidentReportModal from './IncidentReportModal'

export default function BottomDetails({ booking, isDriver = true, onStatusChange, setChatVisible }) {
    const [loading, setLoading] = useState(false)
    const [visible, setVisible] = useState(false)
    const [reporting, setReporting] = useState(false)

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
            <View className="flex-row items-center justify-between px-4">
                <Text>BottomDetails</Text>
                <TouchableOpacity
                    onPress={() => setChatVisible?.(true)}
                    className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                >
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color="#333" />
                </TouchableOpacity>
            </View>

            <Text>{booking.status}</Text>

            <TouchableOpacity onPress={()=>setVisible(true)}>
                <Text>Report</Text>
            </TouchableOpacity>

            {isDriver &&
                <TouchableOpacity onPress={handlePress} disabled={loading}>
                    <Text>
                        {loading
                            ? "..."
                            : booking.status === "accepted" ? "Pick Up" : "Complete"}
                    </Text>
                </TouchableOpacity>
            }

            <IncidentReportModal
            visible={visible}
            onClose={()=>setVisible(false)}
            submitting={reporting}
            bookingId={booking.id}
            />
        </View>
    )
}