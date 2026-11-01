import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import colors from '../../constants/colors'

export default function FareFooter({ price, loading, error, submitting, onBook }) {
    const disabled = submitting || loading;

    return (
        <View className="px-5 pb-4 pt-2">
            <View className="flex-row items-center justify-between mb-4 px-1">
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.dark }}>
                    Total Fare:
                </Text>

                {loading ? (
                    <Text style={{ color: "#6B7280" }}>Calculating...</Text>
                ) : error ? (
                    <Text style={{ color: colors.error }}>{error}</Text>
                ) : (
                    <Text style={{ fontSize: 22, fontWeight: "700", color: colors.primary }}>
                        ₱ {price != null ? price : "--"}
                    </Text>
                )}
            </View>

            <TouchableOpacity
                onPress={onBook}
                disabled={disabled}
                activeOpacity={0.85}
                className="py-4 rounded-full items-center"
                style={{ backgroundColor: colors.secondary, opacity: disabled ? 0.6 : 1 }}
            >
                <Text style={{ color: colors.onPrimary, fontSize: 18, fontWeight: "600" }}>
                    {submitting ? "Booking..." : "Book Now"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}