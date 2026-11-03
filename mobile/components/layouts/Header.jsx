import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { useProfile } from "../../contexts/ProfileContext";
import colors from "../../constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "../../contexts/NotificationContext";
import useNotificationsScreen from "../../hooks/useNotificationsScreen";

export default function Header() {
    const { profile, details } = useProfile();
    const { unreadCount } = useNotifications();
    // the bell opens notifications, and closes them when they're already open
    const { isOpen: notificationsOpen, toggle: toggleNotifications } = useNotificationsScreen();

    const username = profile?.first_name ?? profile?.username ?? "User";
    const photo = details?.profile_picture;
    
    return (
        <View
            className="w-full flex-row items-center justify-between px-4 pt-10 pb-3"
            style={{ backgroundColor: colors.primary }}
        >
            <View className="flex-row items-center gap-4">
                {photo ? (
                    <Image
                        source={{ uri: photo }}
                        className="h-14 w-14 rounded-full"
                        resizeMode="cover"
                    />
                ) : (
                    <View
                        className="h-14 w-14 items-center justify-center rounded-full"
                        style={{ backgroundColor: colors.surface }}
                    >
                        <Text
                            className="text-xl font-bold"
                            style={{ color: colors.primary }}
                        >
                            {username.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                <Text
                    className="text-xl font-semibold"
                    style={{ color: colors.onPrimary }}
                >
                    Hello, {username}!
                </Text>
            </View>

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
        </View>
    );
}