import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import colors from '../../constants/colors'

const LINE = { position: "absolute", width: 1.5, backgroundColor: colors.dark };

// One row of the pickup / stops / drop-off timeline
export default function TimelineRow({
    icon,
    label,
    value,
    placeholder,
    onPress,
    isFirst,
    isLast,
    action,
}) {
    return (
        <View
            className="flex-row items-center"
            style={!isLast ? { borderBottomWidth: 1, borderBottomColor: "#F1F1F1" } : null}
        >
            {/* Rail with connecting line */}
            <View className="w-8 self-stretch items-center justify-center">
                {!isFirst && <View style={[LINE, { top: 0, bottom: "50%" }]} />}
                {!isLast && <View style={[LINE, { top: "50%", bottom: 0 }]} />}
                <View style={{ backgroundColor: colors.surface }}>{icon}</View>
            </View>

            {/* Text */}
            <TouchableOpacity className="flex-1 py-3 pl-2" onPress={onPress}>
                <Text style={{ fontSize: 10, color: "#6B7280" }}>{label}</Text>
                <Text
                    numberOfLines={1}
                    style={{ fontWeight: "700", color: value ? colors.dark : "#9CA3AF" }}
                >
                    {value || placeholder}
                </Text>
            </TouchableOpacity>

            {/* Action button (+ / −) */}
            <View className="w-12 items-center">{action}</View>
        </View>
    );
}