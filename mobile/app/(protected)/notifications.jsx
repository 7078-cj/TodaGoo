import React from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "../../contexts/NotificationContext";
import colors from "../../constants/colors";
import timeAgo from "../../utils/timeAgo";

function NotificationItem({ item, onPress }) {
    return (
        <TouchableOpacity
            onPress={() => onPress(item)}
            activeOpacity={0.7}
            className="flex-row items-start gap-3 px-4 py-4"
            style={{
                backgroundColor: item.read ? colors.background : colors.surface,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
            }}
        >
            <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: item.read ? colors.border : colors.primary }}
            >
                <Ionicons
                    name="notifications"
                    size={20}
                    color={item.read ? colors.dark : colors.onPrimary}
                />
            </View>

            <View className="flex-1">
                <Text
                    className="text-base"
                    style={{ color: colors.dark, fontWeight: item.read ? "400" : "600" }}
                >
                    {item.message}
                </Text>
                <Text className="mt-1 text-sm text-gray-500">{timeAgo(item.created_at)}</Text>
            </View>

            {!item.read && (
                <View className="mt-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />
            )}
        </TouchableOpacity>
    );
}

export default function Notifications() {
    const { notifications, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications();

    const handlePress = (item) => {
        if (!item.read) markRead(item.id);
    };

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="flex-row items-center justify-between px-4 py-3">
                <Text className="text-xl font-bold" style={{ color: colors.dark }}>
                    Notifications
                </Text>

                <TouchableOpacity onPress={markAllRead} disabled={unreadCount === 0}>
                    <Text
                        className="text-base font-medium"
                        style={{ color: colors.primary, opacity: unreadCount === 0 ? 0.4 : 1 }}
                    >
                        Mark all as read
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={notifications}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => <NotificationItem item={item} onPress={handlePress} />}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
                contentContainerStyle={notifications.length === 0 ? { flex: 1 } : undefined}
                ListEmptyComponent={
                    !loading && (
                        <View className="flex-1 items-center justify-center px-8">
                            <Ionicons name="notifications-off-outline" size={48} color={colors.border} />
                            <Text className="mt-3 text-center text-base text-gray-500">
                                You have no notifications yet.
                            </Text>
                        </View>
                    )
                }
            />
        </View>
    );
}
