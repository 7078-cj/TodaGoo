import React, { useEffect } from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname, useRootNavigationState } from "expo-router";
import { useNotifications } from "../contexts/NotificationContext";
import { useProfile } from "../contexts/ProfileContext";
import colors from "../constants/colors";
import { followNotification } from "../constants/notificationRedirects";

const TOAST_DURATION_MS = 4000;

// Pops up when a notification arrives over the socket, anywhere in the protected app
export default function NotificationToast() {
    const { incoming, clearIncoming, markRead } = useNotifications();
    const { role } = useProfile();
    const pathname = usePathname();
    const rootState = useRootNavigationState();
    const onNotificationsScreen = pathname === "/notifications";

    useEffect(() => {
        if (!incoming) return;

        const timer = setTimeout(clearIncoming, TOAST_DURATION_MS);
        return () => clearTimeout(timer);
    }, [incoming, clearIncoming]);

    if (!incoming || onNotificationsScreen) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
                clearIncoming();

                // same redirect as tapping it in the list; otherwise open the list
                if (followNotification(incoming, role, rootState)) markRead(incoming.id);
                else router.push("/notifications");
            }}
            className="absolute left-4 right-4 flex-row items-center gap-3 rounded-2xl px-4 py-3"
            style={{
                top: 110,
                zIndex: 50,
                elevation: 8,
                backgroundColor: colors.surface,
                borderLeftWidth: 4,
                borderLeftColor: colors.primary,
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
            }}
        >
            <Ionicons name="notifications" size={22} color={colors.primary} />
            <Text className="flex-1 text-base" style={{ color: colors.dark }} numberOfLines={2}>
                {incoming.message}
            </Text>
        </TouchableOpacity>
    );
}
