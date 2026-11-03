import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import colors from '../../constants/colors'

const ACTIVE_BG = "#0F5A4A"; // dark green from the design

// Filter keys map to booking statuses; null = all
export const HISTORY_FILTERS = [
    { key: "all", label: "All Rides", status: null },
    { key: "completed", label: "Completed", status: "completed" },
    { key: "cancelled", label: "Cancelled", status: "cancelled" },
];

export default function HistoryFilterTabs({ value, onChange }) {
    return (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 12 }}>
            {HISTORY_FILTERS.map((filter) => {
                const active = filter.key === value;
                return (
                    <TouchableOpacity
                        key={filter.key}
                        onPress={() => onChange(filter.key)}
                        activeOpacity={0.8}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        style={{
                            flex: 1,
                            maxWidth: 110,
                            paddingVertical: 6,
                            borderRadius: 6,
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: active ? ACTIVE_BG : "#9CA3AF",
                            backgroundColor: active ? ACTIVE_BG : "#F3F4F6",
                        }}
                    >
                        <Text style={{ fontSize: 12, color: active ? colors.onPrimary : colors.dark }}>
                            {filter.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
