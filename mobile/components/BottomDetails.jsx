import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native'
import React, { useState, useRef } from 'react'
import newIdempotencyKey from '../utils/idempotencyKey'
import { Ionicons } from '@expo/vector-icons'
import { completeBooking, inProgressBooking } from "../api/book"
import IncidentReportModal from './IncidentReportModal'
import PersonDetailsModal from './PersonDetailsModal'
import colors from '../constants/colors'
import { PICKUP_RADIUS_M, distanceToPickupM } from '../utils/pickupProximity'

const FLAG_BG = "#D9A5A0"; // muted red from the design

/* ---- Media files come back as relative paths like /media/driver_profiles/x.png ----
   Set this to your server origin (no trailing slash, no /api), e.g.
   EXPO_PUBLIC_API_URL=http://192.168.1.78:8000  */
const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || "")
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");

const mediaUrl = (path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// Driver sees the passenger, passenger sees the driver
function getPerson(booking, isDriver) {
    const p = isDriver ? booking?.passenger : booking?.driver;
    if (!p || typeof p !== "object") return null;

    const name = [p.first_name, p.last_name].filter(Boolean).map(cap).join(" ") || p.username || "";

    return {
        role: isDriver ? "passenger" : "driver",
        name,
        phone: p.contact_number ?? "",
        photo: mediaUrl(p.profile_picture),
        rating: p.rating != null ? Number(p.rating) : null,
        address: p.address ?? null,
        todaNumber: p.toda_number ?? null,
        plate: p.vehicle_plate ?? null,
        vehicleFront: mediaUrl(p.vehicle_front_picture),
        vehicleBack: mediaUrl(p.vehicle_back_picture),
    };
}

function Avatar({ uri, size = 52 }) {
    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#E5E7EB" }}
            />
        );
    }
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: "#E5E7EB",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Ionicons name="person" size={size * 0.5} color="#9CA3AF" />
        </View>
    );
}

function Stop({ icon, color, label, address }) {
    return (
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name={icon} size={30} color={color} />
            <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={{ fontWeight: "700", color: colors.dark, fontSize: 14 }}>{label}</Text>
                <Text numberOfLines={2} style={{ fontSize: 10, color: colors.dark }}>
                    {address || "—"}
                </Text>
            </View>
        </View>
    );
}

export default function BottomDetails({
    booking,
    isDriver = true,
    onStatusChange,
    setChatVisible,
    driverLocation,
}) {
    const [loading, setLoading] = useState(false)
    const [visible, setVisible] = useState(false)
    const [detailsVisible, setDetailsVisible] = useState(false)
    const [reporting, setReporting] = useState(false)

    const inProgressKeyRef = useRef(null)
    const completeKeyRef = useRef(null)

    const person = getPerson(booking, isDriver)
    const showAction = isDriver && (booking.status === "accepted" || booking.status === "in_progress")

    // Pickup is only allowed within PICKUP_RADIUS_M of the start point (the backend checks too)
    const distanceToPickup = distanceToPickupM(booking, driverLocation)
    const pickupLocked =
        booking.status === "accepted" && (distanceToPickup == null || distanceToPickup > PICKUP_RADIUS_M)

    const handleInProgress = async () => {
        if (!inProgressKeyRef.current) {
            inProgressKeyRef.current = newIdempotencyKey()
        }

        setLoading(true)
        try {
            const updated = await inProgressBooking(booking.id, inProgressKeyRef.current, driverLocation)
            onStatusChange?.(updated)
            inProgressKeyRef.current = null
        } catch (err) {
            // the request failed, so the next tap is a new attempt
            inProgressKeyRef.current = null
            Alert.alert("Can't pick up yet", err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleComplete = async () => {
        if (!completeKeyRef.current) {
            completeKeyRef.current = newIdempotencyKey()
        }

        setLoading(true)
        try {
            const updated = await completeBooking(booking.id, completeKeyRef.current)
            onStatusChange?.(updated)
            completeKeyRef.current = null
        } catch (err) {
            completeKeyRef.current = null
            Alert.alert("Couldn't complete the ride", err.message)
        } finally {
            setLoading(false)
        }
    }

    const handlePress = () => {
        if (loading || pickupLocked) return
        if (booking.status === "accepted") {
            handleInProgress()
        } else if (booking.status === "in_progress") {
            handleComplete()
        }
    }

    // Close the details sheet first, then open the chat (two modals can't swap instantly on iOS)
    const openChatFromDetails = () => {
        setDetailsVisible(false)
        setTimeout(() => setChatVisible?.(true), 350)
    }

    return (
        <View
            style={{
                minHeight: "40%",
                backgroundColor: colors.background,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 20,
                justifyContent: "space-between",
            }}
        >
            {/* Fare + type badge + report */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "700", color: colors.dark }}>
                    ₱ {booking.price ?? "--"}
                </Text>


                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    onPress={() => setVisible(true)}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: FLAG_BG,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Ionicons name="flag-outline" size={18} color={colors.onPrimary} />
                </TouchableOpacity>
            </View>

            {/* Start -> End */}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}>
                <Stop
                    icon="location-sharp"
                    color={colors.primary}
                    label="Start"
                    address={booking.start_address}
                />
                <Ionicons
                    name="arrow-forward"
                    size={26}
                    color={colors.dark}
                    style={{ marginHorizontal: 8 }}
                />
                <Stop
                    icon="location-sharp"
                    color={colors.secondary}
                    label="End"
                    address={booking.end_address}
                />
            </View>

            {/* Driver (for passengers) or Passenger (for drivers) */}
            {person && (
                <View style={{ marginTop: 16 }}>
                    <Text style={{ fontWeight: "700", color: colors.dark, fontSize: 13 }}>
                        {isDriver ? "Passenger:" : "Driver:"}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setDetailsVisible(true)}
                            style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                        >
                            <Avatar uri={person.photo} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text numberOfLines={1} style={{ fontWeight: "700", color: colors.dark, fontSize: 14 }}>
                                    {person.name}
                                </Text>
                                {!!person.phone && (
                                    <Text style={{ color: "#6B7280", fontSize: 12 }}>{person.phone}</Text>
                                )}
                                <Text style={{ color: colors.dark, fontSize: 10, letterSpacing: 0.5 }}>
                                    Tap for more details
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setChatVisible?.(true)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="mail-outline" size={40} color={colors.dark} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Driver action */}
            {showAction && (
                <TouchableOpacity
                    onPress={handlePress}
                    disabled={loading || pickupLocked}
                    activeOpacity={0.85}
                    style={{
                        marginTop: 18,
                        backgroundColor: colors.secondary,
                        borderRadius: 999,
                        paddingVertical: 16,
                        alignItems: "center",
                        opacity: loading ? 0.7 : pickupLocked ? 0.5 : 1,
                    }}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                        <Text style={{ color: colors.onPrimary, fontSize: 20 }}>
                            {booking.status === "accepted" ? "Pick Up Passenger" : "Complete Ride"}
                        </Text>
                    )}
                </TouchableOpacity>
            )}

            {showAction && pickupLocked && (
                <Text style={{ marginTop: 8, textAlign: "center", color: colors.dark, fontSize: 12 }}>
                    {distanceToPickup == null
                        ? "Getting your location..."
                        : `You are ${Math.round(distanceToPickup)} m away. Get within ${PICKUP_RADIUS_M} m of the pickup point to pick up the passenger.`}
                </Text>
            )}

            <PersonDetailsModal
                visible={detailsVisible}
                onClose={() => setDetailsVisible(false)}
                person={person}
                onMessage={openChatFromDetails}
            />

            <IncidentReportModal
                visible={visible}
                onClose={() => setVisible(false)}
                submitting={reporting}
                bookingId={booking.id}
            />
        </View>
    )
}