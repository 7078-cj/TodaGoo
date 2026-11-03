import { View, Text, TouchableOpacity, Image } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import colors from '../../constants/colors'
import formatPhone from '../../utils/formatPhone'
import { mediaUrl } from '../../utils/person'
import { TappablePhoto } from '../PhotoViewer'

function DetailRow({ icon, label, value }) {
    if (!value) return null
    return (
        <View style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 10 }}>
            <View
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: "#E5E7EB",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Ionicons name={icon} size={18} color={colors.dark} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.dark }}>{label}</Text>
                <Text style={{ fontSize: 14, color: colors.dark, marginTop: 2 }}>{value}</Text>
            </View>
        </View>
    )
}

function VehiclePhoto({ uri, label }) {
    return (
        <View style={{ flex: 1 }}>
            {uri ? (
                <TappablePhoto uri={uri} accessibilityLabel={`View ${label.toLowerCase()} vehicle photo`}>
                    <Image source={{ uri }} style={{ width: "100%", height: 100, borderRadius: 10, backgroundColor: "#E5E7EB" }} />
                </TappablePhoto>
            ) : (
                <View style={{ height: 100, borderRadius: 10, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="image-outline" size={26} color="#9CA3AF" />
                </View>
            )}
            <Text style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 4 }}>{label}</Text>
        </View>
    )
}

// Rows shown per role; `get` reads from the `me/` response ({ username, ..., <role>_profile })
const DETAIL_ROWS = {
    passenger: [
        { icon: "person-outline", label: "Username", get: (p) => p?.username },
        { icon: "call-outline", label: "Phone Number", get: (p, d) => formatPhone(d?.contact_number) },
        { icon: "people-outline", label: "Emergency Contact Person", get: (p, d) => d?.emergency_contact_name },
        { icon: "call-outline", label: "Emergency Contact Number", get: (p, d) => formatPhone(d?.emergency_contact_number) },
        { icon: "location-outline", label: "Address", get: (p, d) => d?.address },
    ],
    driver: [
        { icon: "person-outline", label: "Username", get: (p) => p?.username },
        { icon: "call-outline", label: "Phone Number", get: (p, d) => formatPhone(d?.contact_number) },
        { icon: "pricetag-outline", label: "TODA Number", get: (p, d) => d?.toda_number },
        { icon: "car-outline", label: "Plate Number", get: (p, d) => d?.vehicle_plate },
        { icon: "location-outline", label: "Address", get: (p, d) => d?.address },
    ],
}

export default function DetailsTab({ role, profile, details, onChangePassword, onLogout }) {
    const rows = DETAIL_ROWS[role] ?? DETAIL_ROWS.passenger

    return (
        <View style={{ padding: 16 }}>
            {rows.map((row) => (
                <DetailRow key={row.label} icon={row.icon} label={row.label} value={row.get(profile, details)} />
            ))}

            {role === "driver" && (
                <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.dark, marginBottom: 8 }}>Vehicle Photos</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <VehiclePhoto uri={mediaUrl(details?.vehicle_front_picture)} label="Front" />
                        <VehiclePhoto uri={mediaUrl(details?.vehicle_back_picture)} label="Back" />
                    </View>
                </View>
            )}

            <TouchableOpacity
                onPress={onChangePassword}
                activeOpacity={0.8}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 20,
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <Ionicons name="lock-closed-outline" size={20} color={colors.dark} />
                <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, fontWeight: "600", color: colors.dark }}>Change Password</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onLogout}
                activeOpacity={0.85}
                style={{
                    alignSelf: "flex-end",
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 20,
                    backgroundColor: colors.error,
                    borderRadius: 999,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                }}
            >
                <Ionicons name="log-out-outline" size={18} color={colors.onPrimary} />
                <Text style={{ marginLeft: 6, color: colors.onPrimary, fontWeight: "600" }}>Log Out</Text>
            </TouchableOpacity>
        </View>
    )
}
