import { View, Text } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import colors from '../../constants/colors'
import formatCoordinates from '../../utils/formatCoordinates'
import formatPhone from '../../utils/formatPhone'

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "")
export const fullName = (p) => [p?.first_name, p?.last_name].filter(Boolean).map(cap).join(" ") || p?.username || ""

export function InfoRow({ label, value, italic = false, last = false }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                borderBottomWidth: last ? 0 : 1,
                borderBottomColor: colors.border,
            }}
        >
            <Text style={{ fontSize: 12, color: colors.dark }}>{label}</Text>
            <Text
                style={{ flex: 1, marginLeft: 12, textAlign: "right", fontSize: 12, fontWeight: "700", color: colors.dark, fontStyle: italic ? "italic" : "normal" }}
            >
                {value || "—"}
            </Text>
        </View>
    )
}

// "Auto-Attached Information" card shared by the report form and Report Details:
// GPS (degrees/minutes/seconds), route, driver (name + plate), passenger (name + phone)
export default function AutoAttachedInfo({ booking, location }) {
    const driver = booking?.driver
    const passenger = booking?.passenger

    return (
        <View style={{ backgroundColor: "#F3F4F6", borderRadius: 12, padding: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, marginLeft: 4 }}>
                <Ionicons name="location-outline" size={16} color={colors.dark} />
                <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: "600", color: colors.dark }}>Auto-Attached Information</Text>
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12 }}>
                <InfoRow label="GPS Location:" value={location ? formatCoordinates(location) : "Getting location..."} />
                <InfoRow label="Route:" value={booking?.start_address && `${booking.start_address} → ${booking.end_address}`} />
                <InfoRow label="Driver:" value={driver && `${fullName(driver)}${driver.vehicle_plate ? ` (${driver.vehicle_plate})` : ""}`} />
                <InfoRow
                    label="Passenger:"
                    value={passenger && `${fullName(passenger)}${passenger.contact_number ? ` (${formatPhone(passenger.contact_number)})` : ""}`}
                    last
                />
            </View>
        </View>
    )
}
