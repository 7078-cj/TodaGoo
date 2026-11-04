import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import { ERROR_MESSAGES } from "../../constants/errors";

// Icon per error kind (from utils/requests.js results); anything else uses the default
const ICONS = {
    network: "cloud-offline-outline",
    timeout: "time-outline",
    auth: "lock-closed-outline",
    not_found: "search-outline",
    default: "alert-circle-outline",
};

// "Couldn't load" block with a Try again button, for a screen, tab or list.
//   <ErrorState message={error} onRetry={load} />
//   <ErrorState kind="network" onRetry={load} />        // default text for the kind
//   <ErrorState fill={false} ... />                      // inside a scroll view / tab
export default function ErrorState({ message, kind, onRetry, retryLabel = "Try again", fill = true, style }) {
    const text = message || ERROR_MESSAGES[kind] || ERROR_MESSAGES.generic;

    return (
        <View
            accessibilityRole="alert"
            style={[{ alignItems: "center", justifyContent: "center", padding: 24 }, fill && { flex: 1 }, style]}
        >
            <Ionicons name={ICONS[kind] ?? ICONS.default} size={44} color="#9CA3AF" />
            <Text style={{ marginTop: 10, fontSize: 14, color: "#4B5563", textAlign: "center" }}>{text}</Text>
            {onRetry ? (
                <TouchableOpacity
                    onPress={onRetry}
                    accessibilityRole="button"
                    style={{ marginTop: 14, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: colors.primary }}
                >
                    <Text style={{ color: colors.primary, fontWeight: "600" }}>{retryLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
