import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import colors from '../constants/colors'
import { rideDistanceKm, rideDurationMin, formatDistance, formatDuration } from '../utils/rideStats'

const GREEN = "#0F5A4A"

// Wording per role (the design's "Fare Earned" fits drivers; passengers see "Total Fare")
const RECEIPT_COPY = {
    driver: { title: "Excellent Work!", fareLabel: "Fare Earned:", button: "Rate Passenger" },
    passenger: { title: "You've Arrived!", fareLabel: "Total Fare:", button: "Rate Driver" },
}

function Row({ label, value }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 12, color: colors.dark }}>{label}</Text>
            <Text numberOfLines={2} style={{ flex: 1, marginLeft: 12, textAlign: "right", fontSize: 12, fontWeight: "700", color: colors.dark }}>
                {value || "—"}
            </Text>
        </View>
    )
}

// Shown when a ride is completed, before rating the other person.
// role: "driver" | "passenger" (who is looking at it); onRate: go to the rating step.
export default function RideReceiptScreen({ booking, role, onRate }) {
    const copy = RECEIPT_COPY[role] ?? RECEIPT_COPY.passenger

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "space-between" }}>
            <View>
                <View style={{ alignItems: "center", marginTop: 8 }}>
                    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark" size={44} color={colors.onPrimary} />
                    </View>
                    <Text style={{ marginTop: 16, fontSize: 20, fontWeight: "700", color: colors.dark }}>{copy.title}</Text>
                </View>

                <View
                    style={{
                        marginTop: 20,
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingBottom: 4,
                        shadowColor: "#000",
                        shadowOpacity: 0.08,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 1 },
                        elevation: 2,
                    }}
                >
                    <Row label="Pickup:" value={booking?.start_address} />
                    <Row label="Drop-off:" value={booking?.end_address} />
                    <Row label="Distance:" value={formatDistance(rideDistanceKm(booking))} />
                    <Row label="Duration:" value={formatDuration(rideDurationMin(booking))} />

                    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 }}>
                        <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: colors.dark }}>{copy.fareLabel}</Text>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.dark }}>₱ {booking?.price ?? "--"}</Text>
                        {booking?.type === "special" && (
                            <View style={{ marginLeft: 8, backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text style={{ color: colors.onPrimary, fontSize: 10 }}>Priority</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            <TouchableOpacity
                onPress={onRate}
                activeOpacity={0.85}
                accessibilityRole="button"
                style={{ marginTop: 32, backgroundColor: GREEN, borderRadius: 999, paddingVertical: 16, alignItems: "center" }}
            >
                <Text style={{ color: colors.onPrimary, fontSize: 17, fontWeight: "600" }}>{copy.button}</Text>
            </TouchableOpacity>
        </ScrollView>
    )
}
