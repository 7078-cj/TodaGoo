import { View, Text, ActivityIndicator } from 'react-native'
import React, { useState, useCallback, useRef } from 'react'
import { router, useFocusEffect } from 'expo-router'
import ButtonComponent from '@/components/ButtonComponent'
import { driverQueue, driverQueueStatus } from '@/api/driver'
import { getLocation } from "@/utils/location"

// Adjust to your driver trip screen
const TRIP_ROUTE = "/(protected)/driver/en_route"

export default function home() {
    const [location, setLocation] = useState(null)
    const [errorMsg, setErrorMsg] = useState(null)
    const [isReady, setIsReady] = useState(false)
    const [enRoute, setEnRoute] = useState(false)
    const [joining, setJoining] = useState(false)
    const [loading, setLoading] = useState(true)

    // Only auto-redirect once, so coming back to home doesn't bounce the driver away again
    const hasRedirectedRef = useRef(false)

    const checkStatus = useCallback(async () => {
        try {
            const res = await driverQueueStatus()
            console.log('Driver queue status:', res)

            setIsReady(!!res.ready)
            setEnRoute(!!res.en_route)
            setErrorMsg(null)

            if (res.ready && res.location) {
                setLocation({ coords: { latitude: res.location.lat, longitude: res.location.lng } })
            } else {
                setLocation(null)
            }

            if (res.en_route && !hasRedirectedRef.current) {
                hasRedirectedRef.current = true
                router.replace(TRIP_ROUTE)
            }
        } catch (err) {
            setErrorMsg('Failed to fetch driver status')
        } finally {
            setLoading(false)
        }
    }, [])

    // Re-check every time the screen comes into focus (e.g. after finishing a trip)
    useFocusEffect(
        useCallback(() => {
            checkStatus()
        }, [checkStatus])
    )

    const driverReady = async () => {
        if (joining || enRoute) return

        setErrorMsg(null)
        setJoining(true)

        try {
            const loc = await getLocation({ setLocation, setErrorMsg })
            if (!loc) return

            await driverQueue({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
            })
            setIsReady(true)
        } catch (err) {
            setErrorMsg(err?.response?.data?.error || 'Failed to join queue')
        } finally {
            setJoining(false)
        }
    }

    if (loading) {
        return (
            <View>
                <ActivityIndicator />
            </View>
        )
    }

    const statusLabel = enRoute ? 'En route' : isReady ? 'Ready' : 'Not ready'

    return (
        <View>
            <Text>driver home</Text>
            <Text>Status: {statusLabel}</Text>
            {errorMsg && <Text>{errorMsg}</Text>}

            {location && !enRoute && (
                <Text>
                    Lat: {location.coords.latitude}, Lng: {location.coords.longitude}
                </Text>
            )}

            {enRoute && (
                <ButtonComponent onPress={() => router.push(TRIP_ROUTE)} label={"Go to trip"} />
            )}

            {!isReady && !enRoute && (
                <ButtonComponent
                    onPress={driverReady}
                    label={joining ? "Joining..." : "Ready"}
                />
            )}
        </View>
    )
}