import { View, Text, TouchableOpacity } from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "../../constants/colors";

export default function ChatHeader({ title = "Message", onBack, onNotifPress }) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={{
                backgroundColor: colors.primary,
                paddingTop: insets.top + 8,
                paddingBottom: 12,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
            }}
        >
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-back" size={26} color={colors.onPrimary} />
            </TouchableOpacity>

            <Text
                style={{
                    flex: 1,
                    marginLeft: 12,
                    color: colors.onPrimary,
                    fontSize: 18,
                    fontWeight: "600",
                }}
                numberOfLines={1}
            >
                {title}
            </Text>

            <TouchableOpacity onPress={onNotifPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="notifications-outline" size={26} color={colors.onPrimary} />
            </TouchableOpacity>
        </View>
    );
}