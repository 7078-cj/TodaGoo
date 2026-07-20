import { View, Text, ActivityIndicator } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import * as Location from 'expo-location'
import ButtonComponent from '@/components/ButtonComponent'
import { driverQueue, driverQueueStatus } from '@/api/driver'

export default function home() {
    const [location, setLocation] = useState(null)
    const [errorMsg, setErrorMsg] = useState(null)
    const [isReady, setIsReady] = useState(false)
    const [loading, setLoading] = useState(true)

    const checkStatus = useCallback(async () => {
        try {
            const res = await driverQueueStatus()
            setIsReady(res.ready)
            if (res.ready && res.location) {
                setLocation({ coords: { latitude: res.location.lat, longitude: res.location.lng } })
            }
        } catch (err) {
            setErrorMsg('Failed to fetch driver status')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        checkStatus()
    }, [checkStatus])

    const getLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
            setErrorMsg('Permission to access location was denied')
            return null
        }

        const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        })
        setLocation(loc)
        return loc
    }

    const driverReady = async () => {
        setErrorMsg(null)
        const loc = await getLocation()
        if (!loc) return

        try {
            await driverQueue({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
            })
            setIsReady(true)
        } catch (err) {
            setErrorMsg(err?.response?.data?.error || 'Failed to join queue')
        }
    }

    if (loading) {
        return (
            <View>
                <ActivityIndicator />
            </View>
        )
    }

    return (
        <View>
            <Text>driver home</Text>
            <Text>Status: {isReady ? 'Ready' : 'Not ready'}</Text>
            {errorMsg && <Text>{errorMsg}</Text>}
            {location && (
                <Text>
                    Lat: {location.coords.latitude}, Lng: {location.coords.longitude}
                </Text>
            )}
            {!isReady && (
                <ButtonComponent onPress={driverReady} label={"Ready"} />
            )}
        </View>
    )
}