import { View, Text, TouchableOpacity, Linking, Share } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import colors from '../../constants/colors'
import { HOTLINES } from '../../constants/hotlines'

function HotlineRow({ hotline }) {
    const call = () => Linking.openURL(`tel:${hotline.number.replace(/\s/g, "")}`)
    // No clipboard package in the app yet; the share sheet has "Copy" on both platforms
    const share = () => Share.share({ message: hotline.number })

    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.dark }}>{hotline.name}</Text>
            <Text style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>{hotline.description}</Text>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.surface,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <TouchableOpacity
                    onPress={call}
                    style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${hotline.name} at ${hotline.number}`}
                >
                    <Text style={{ fontSize: 14, color: colors.dark }}>{hotline.number}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={share}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ paddingHorizontal: 14 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Copy or share ${hotline.name} number`}
                >
                    <Ionicons name="copy-outline" size={20} color={colors.dark} />
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default function HotlinesTab() {
    return (
        <View style={{ padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
                <Ionicons name="alert-circle" size={40} color={colors.error} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 20, fontWeight: "700", color: colors.dark }}>
                        Witnessed an incident? Report them now.
                    </Text>
                    <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                        Contact the authorities immediately if you witnessed an incident or unsafe behavior. Tap a number to call.
                    </Text>
                </View>
            </View>

            {HOTLINES.map((hotline) => (
                <HotlineRow key={hotline.name} hotline={hotline} />
            ))}
        </View>
    )
}
