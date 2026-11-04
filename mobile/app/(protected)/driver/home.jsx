import { View, Text, ActivityIndicator, TouchableOpacity, Image, Alert } from 'react-native'
import React, { useState, useCallback, useRef } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from "react-native-safe-area-context";
import MapComponent from '@/components/map/MapComponent'
import { driverQueue, driverDequeue, driverQueueStatus } from '@/api/driver'
import { getLocation } from "@/utils/location"
import { setDriverOnline } from "@/utils/driverOnlineStore"
import { LoadingScreen } from '@/components/loading';
import { LOADING_MESSAGES } from '@/constants/loading';

// Adjust to your driver trip screen
const TRIP_ROUTE = "/(protected)/driver/en_route"

const GREEN = "#0F5A4A"        // Ready / Go to trip
const WAITING_GREY = "#7C9A85" // "Waiting for booking..." (design's muted green)

function HomeButton({ label, onPress, disabled = false, color = GREEN, loading = false }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{ backgroundColor: color, paddingVertical: 16, borderRadius: 999, alignItems: "center" }}
        >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "500" }}>{label}</Text>
            )}
        </TouchableOpacity>
    )
}

export default function DriverHome() {
    const [errorMsg, setErrorMsg] = useState(null)
    const [isReady, setIsReady] = useState(false)
    const [enRoute, setEnRoute] = useState(false)
    const [joining, setJoining] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [loading, setLoading] = useState(true)

    // Only auto-redirect once, so coming back to home doesn't bounce the driver away again
    const hasRedirectedRef = useRef(false)

    const checkStatus = useCallback(async () => {
        try {
            const res = await driverQueueStatus()

            setIsReady(!!res.ready)
            setEnRoute(!!res.en_route)
            setDriverOnline(!!res.ready)
            setErrorMsg(null)

            if (res.en_route && !hasRedirectedRef.current) {
                hasRedirectedRef.current = true
                router.replace(TRIP_ROUTE)
            }
        } catch {
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
            const loc = await getLocation({ setErrorMsg })
            if (!loc) return

            await driverQueue({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
            })
            setIsReady(true)
            setDriverOnline(true)
        } catch (err) {
            setErrorMsg(err.message || 'Failed to go online')
        } finally {
            setJoining(false)
        }
    }

    // Leave the queue; offers stop until the driver taps Ready again
    const goOffline = () => {
        Alert.alert("Go offline?", "You won't receive booking requests until you're Ready again.", [
            { text: "Stay Online", style: "cancel" },
            {
                text: "Go Offline",
                style: "destructive",
                onPress: async () => {
                    setLeaving(true)
                    setErrorMsg(null)
                    try {
                        await driverDequeue()
                        setIsReady(false)
                        setDriverOnline(false)
                    } catch (err) {
                        // e.g. a booking was just offered (the offer takes the driver out of the queue)
                        setErrorMsg(err.message || 'Failed to go offline')
                        checkStatus()
                    } finally {
                        setLeaving(false)
                    }
                },
            },
        ])
    }

    const message = enRoute ? (
        <Text style={{ fontSize: 22, color: "#1F2937" }}>
            <Text style={{ fontWeight: "700" }}>{"You're on a trip."}</Text> Open it to see the route and your passenger.
        </Text>
    ) : isReady ? (
        <Text style={{ fontSize: 22, color: "#1F2937" }}>
            <Text style={{ fontWeight: "700" }}>{"You're Online."}</Text>
            {"\nWe'll Alert You When a Booking Comes In."}
        </Text>
    ) : (
        <Text style={{ fontSize: 22, color: "#1F2937" }}>
            To Accept Booking From Passengers You Must be <Text style={{ fontWeight: "700" }}>Ready</Text>
        </Text>
    )

    return (
        <SafeAreaView className="flex-1 bg-[#FBF8EC]" edges={["left", "right"]}>
            {/* Map: marks the driver */}
            <View style={{ flex: 1.1 }}>
                <MapComponent location={null} userLocation={true} editMode={false} isRoute={false} canHover={false} />
            </View>

            {/* Bottom card */}
            <View className="flex bg-[#FBF8EC] px-6 pt-6 pb-8 justify-center">
                {loading ? (
                    <LoadingScreen fill={false} message={LOADING_MESSAGES.driverStatus} style={{ paddingVertical: 40 }} />
                ) : (
                    <>
                        <View className="flex-row items-center justify-between mb-5">
                            <View style={{ flex: 1, paddingRight: 12 }}>{message}</View>
                            <Image
                                source={require('@/assets/passenger_home.png')}
                                style={{ width: 150, height: 150 }}
                                resizeMode="contain"
                            />
                        </View>

                        {errorMsg ? (
                            <Text style={{ color: "#DC2626", fontSize: 12, marginBottom: 8, textAlign: "center" }}>{errorMsg}</Text>
                        ) : null}

                        {enRoute ? (
                            <HomeButton label="Go to Trip" onPress={() => router.push(TRIP_ROUTE)} />
                        ) : isReady ? (
                            <>
                                <HomeButton label="Waiting for booking..." disabled color={WAITING_GREY} />
                                <TouchableOpacity
                                    onPress={goOffline}
                                    disabled={leaving}
                                    accessibilityRole="button"
                                    style={{ alignSelf: "center", marginTop: 12, paddingVertical: 4, paddingHorizontal: 12 }}
                                >
                                    <Text style={{ color: "#DC2626", fontWeight: "600" }}>
                                        {leaving ? "Going offline..." : "Go Offline"}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <HomeButton label="Ready" onPress={driverReady} loading={joining} />
                        )}
                    </>
                )}
            </View>
        </SafeAreaView>
    )
}
