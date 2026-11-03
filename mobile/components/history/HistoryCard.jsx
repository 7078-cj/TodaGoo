import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import colors from '../../constants/colors'
import formatDateTime from '../../utils/formatDateTime'

// Accent per status: left border, icon background, icon
export const STATUS_STYLES = {
    completed: { accent: "#1F6B4F", iconBg: colors.success, icon: "checkmark", label: "Completed" },
    cancelled: { accent: colors.error, iconBg: colors.error, icon: "close", label: "Cancelled" },
};

export default function HistoryCard({ booking, onPress }) {
    const style = STATUS_STYLES[booking.status] ?? STATUS_STYLES.completed;

    return (
        <TouchableOpacity
            onPress={() => onPress(booking)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${style.label} ride from ${booking.start_address} to ${booking.end_address}`}
            style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surface,
                borderRadius: 10,
                borderLeftWidth: 4,
                borderLeftColor: style.accent,
                paddingVertical: 12,
                paddingHorizontal: 12,
                marginBottom: 10,
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
            }}
        >
            <View
                style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: style.iconBg,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Ionicons name={style.icon} size={16} color={colors.onPrimary} />
            </View>

            <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: colors.dark }}>
                    {booking.start_address} → {booking.end_address}
                </Text>
                <Text style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>
                    {formatDateTime(booking.created_at)}
                </Text>
            </View>

            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.dark }}>₱ {booking.price}</Text>
        </TouchableOpacity>
    );
}
