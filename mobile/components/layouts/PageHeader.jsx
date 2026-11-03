import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import colors from "../../constants/colors";
import { useProfile } from "../../contexts/ProfileContext";
import NotificationBell from "./NotificationBell";

// Titled header for inner screens (back · title · bell), used in place of the "Hello" Header.
export default function PageHeader({ title }) {
    const { role } = useProfile();

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace(`/(protected)/${role === "driver" ? "driver" : "passenger"}/home`);
    };

    return (
        <View
            className="w-full flex-row items-center px-4 pt-10 pb-3"
            style={{ backgroundColor: colors.primary }}
        >
            <TouchableOpacity
                onPress={goBack}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Go back"
            >
                <Ionicons name="chevron-back" size={26} color={colors.onPrimary} />
            </TouchableOpacity>

            <Text className="ml-3 flex-1 text-xl font-semibold" style={{ color: colors.onPrimary }}>
                {title}
            </Text>

            <NotificationBell />
        </View>
    );
}
