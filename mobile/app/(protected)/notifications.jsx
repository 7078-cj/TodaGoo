import React, { useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRootNavigationState } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "../../contexts/NotificationContext";
import { useProfile } from "../../contexts/ProfileContext";
import { followNotification } from "../../constants/notificationRedirects";
import { notificationStyle } from "../../constants/notificationTypes";
import colors from "../../constants/colors";
import timeAgo from "../../utils/timeAgo";
import PageHeader from "../../components/layouts/PageHeader";
import { LoadingScreen } from "../../components/loading";
import { LOADING_MESSAGES } from "../../constants/loading";

const SELECTED_TINT = "#FDF0E7";

// One card: type icon · title / message / time · trash (or a checkbox in select mode)
function NotificationCard({ item, onPress, onLongPress, onDelete, selecting, selected }) {
    const { title, icon, color } = notificationStyle(item.type);

    return (
        <TouchableOpacity
            onPress={() => onPress(item)}
            onLongPress={() => onLongPress(item)}
            delayLongPress={350}
            activeOpacity={0.75}
            accessibilityRole={selecting ? "checkbox" : "button"}
            accessibilityState={selecting ? { checked: selected } : undefined}
            accessibilityHint={selecting ? undefined : "Long press to select"}
            className="mx-4 mb-3 flex-row items-center rounded-2xl px-4 py-4 gap-4"
            style={{
                backgroundColor: selected ? SELECTED_TINT : colors.surface,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
            }}
        >
            <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
                <Ionicons name={icon} size={22} color={colors.onPrimary} />
            </View>

            <View className="ml-4 flex-1">
                <View className="flex-row items-center">
                    <Text
                        className="flex-shrink text-base"
                        numberOfLines={1}
                        style={{ color: colors.dark, fontWeight: item.read ? "600" : "700" }}
                    >
                        {title}
                    </Text>
                    {!item.read && (
                        <View className="ml-2 h-2 w-2 rounded-full" style={{ backgroundColor: colors.primary }} />
                    )}
                </View>
                <Text className="mt-0.5 text-sm" style={{ color: colors.dark }} numberOfLines={2}>
                    {item.message}
                </Text>
                <Text className="mt-1 text-xs text-gray-500">{timeAgo(item.created_at)}</Text>
            </View>

            {selecting ? (
                <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={26}
                    color={selected ? colors.primary : "#C4C4C4"}
                    style={{ marginLeft: 8 }}
                />
            ) : (
                <TouchableOpacity
                    onPress={() => onDelete(item)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Delete notification"
                    style={{ marginLeft: 8, padding: 4 }}
                >
                    <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
}

// White text / icon button for the orange header
function HeaderButton({ label, icon, onPress, disabled = false }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            className="flex-row items-center"
            style={{ opacity: disabled ? 0.5 : 1 }}
        >
            {icon && <Ionicons name={icon} size={20} color={colors.onPrimary} />}
            <Text className="ml-1 text-base font-medium" style={{ color: colors.onPrimary }}>{label}</Text>
        </TouchableOpacity>
    );
}

export default function Notifications() {
    const { notifications, unreadCount, loading, refresh, markRead, markAllRead, deleteMany } = useNotifications();
    const insets = useSafeAreaInsets();

    const { role } = useProfile();
    const rootState = useRootNavigationState();

    // select mode: tick cards, then "Delete (n)"
    const [selecting, setSelecting] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [deleting, setDeleting] = useState(false);

    // only ids still in the list count (one may have been deleted on another device)
    const selectedCount = useMemo(
        () => notifications.filter((n) => selectedIds.has(n.id)).length,
        [notifications, selectedIds]
    );
    const allSelected = notifications.length > 0 && selectedCount === notifications.length;

    const toggle = (id) =>
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const startSelecting = (item) => {
        setSelecting(true);
        setSelectedIds(new Set(item ? [item.id] : []));
    };

    const stopSelecting = () => {
        setSelecting(false);
        setSelectedIds(new Set());
    };

    const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(notifications.map((n) => n.id)));

    // configured per type in constants/notificationRedirects.js
    const handlePress = (item) => {
        if (selecting) {
            toggle(item.id);
            return;
        }
        if (!item.read) markRead(item.id);

        followNotification(item, role, rootState);
    };

    const remove = (ids, onDone) => {
        Alert.alert(
            ids.length > 1 ? `Delete ${ids.length} notifications?` : "Delete notification?",
            "This can't be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            await deleteMany(ids);
                            onDone?.();
                        } catch (err) {
                            Alert.alert("Couldn't delete", err.message);
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ]
        );
    };

    const deleteSelected = () => {
        const ids = notifications.filter((n) => selectedIds.has(n.id)).map((n) => n.id);
        if (ids.length) remove(ids, stopSelecting);
    };

    const header = selecting ? (
        <PageHeader
            title={`${selectedCount} selected`}
            onBack={stopSelecting}
            right={<HeaderButton label={allSelected ? "Deselect all" : "Select all"} onPress={toggleAll} />}
        />
    ) : (
        <PageHeader
            title="Notifications"
            right={
                <HeaderButton
                    label="Select"
                    icon="checkbox-outline"
                    onPress={() => startSelecting(null)}
                    disabled={notifications.length === 0}
                />
            }
        />
    );

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            {header}

            {!selecting && unreadCount > 0 && (
                <View className="flex-row items-center justify-between px-5 pt-4">
                    <Text className="text-sm text-gray-500">{unreadCount} unread</Text>
                    <TouchableOpacity onPress={markAllRead} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text className="text-sm font-semibold" style={{ color: colors.primary }}>Mark all as read</Text>
                    </TouchableOpacity>
                </View>
            )}

            {selecting && (
                <Text className="px-5 pt-4 text-sm text-gray-500">Tap notifications to select them.</Text>
            )}

            <FlatList
                data={notifications}
                keyExtractor={(item) => String(item.id)}
                extraData={{ selecting, selectedIds }}
                renderItem={({ item }) => (
                    <NotificationCard
                        item={item}
                        onPress={handlePress}
                        onLongPress={(n) => (selecting ? toggle(n.id) : startSelecting(n))}
                        onDelete={(n) => remove([n.id])}
                        selecting={selecting}
                        selected={selecting && selectedIds.has(item.id)}
                    />
                )}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
                contentContainerStyle={notifications.length === 0 ? { flex: 1 } : { paddingTop: 16, paddingBottom: 16 }}
                ListEmptyComponent={
                    loading ? (
                        <LoadingScreen message={LOADING_MESSAGES.notifications} />
                    ) : (
                        <View className="flex-1 items-center justify-center px-8">
                            <View className="h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: colors.surface }}>
                                <Ionicons name="notifications-off-outline" size={36} color="#9CA3AF" />
                            </View>
                            <Text className="mt-4 text-base font-semibold" style={{ color: colors.dark }}>No notifications</Text>
                            <Text className="mt-1 text-center text-sm text-gray-500">
                                Updates about your rides and reports will show up here.
                            </Text>
                        </View>
                    )
                }
            />

            {selecting && (
                <View
                    className="flex-row items-center px-4 pt-3"
                    style={{
                        gap: 12,
                        paddingBottom: 12 + Math.min(insets.bottom, 8),
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        backgroundColor: colors.surface,
                    }}
                >
                    <TouchableOpacity
                        onPress={stopSelecting}
                        accessibilityRole="button"
                        className="flex-1 items-center rounded-full py-3"
                        style={{ borderWidth: 1, borderColor: colors.border }}
                    >
                        <Text className="text-base font-semibold" style={{ color: colors.dark }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={deleteSelected}
                        disabled={selectedCount === 0 || deleting}
                        accessibilityRole="button"
                        className="flex-1 flex-row items-center justify-center rounded-full py-3"
                        style={{ backgroundColor: colors.error, opacity: selectedCount === 0 || deleting ? 0.5 : 1 }}
                    >
                        <Ionicons name="trash-outline" size={18} color={colors.onPrimary} />
                        <Text className="ml-2 text-base font-semibold" style={{ color: colors.onPrimary }}>
                            {deleting ? "Deleting..." : `Delete${selectedCount ? ` (${selectedCount})` : ""}`}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
