import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import { useNotifications } from "../../contexts/NotificationContext";
import useNotificationsScreen from "../../hooks/useNotificationsScreen";

// Header bell with the unread badge. Opens notifications, and closes them when they're already open.
export default function NotificationBell() {
    const { unreadCount } = useNotifications();
    const { isOpen: notificationsOpen, toggle: toggleNotifications } = useNotificationsScreen();

    return (
        <TouchableOpacity
            onPress={toggleNotifications}
            activeOpacity={0.7}
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: notificationsOpen ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)" }}
            accessibilityRole="button"
            accessibilityLabel={notificationsOpen ? "Close notifications" : "Notifications"}
            accessibilityState={{ expanded: notificationsOpen }}
        >
            <Ionicons
                name={notificationsOpen ? "notifications" : "notifications-outline"}
                size={25}
                color={colors.onPrimary}
            />
            {unreadCount > 0 && (
                <View
                    className="absolute -right-1 -top-1 h-5 items-center justify-center rounded-full px-1"
                    style={{ minWidth: 20, backgroundColor: colors.error }}
                >
                    <Text className="text-xs font-bold" style={{ color: colors.onPrimary }}>
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}
