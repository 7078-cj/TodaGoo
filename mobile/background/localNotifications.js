import { Platform } from "react-native";
import { Notifications } from "./native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BG_KEYS, CHANNELS } from "./config";
import { notificationStyle } from "../constants/notificationTypes";

// Phone (system) notifications made on the device, no push server involved. Shown while
// TodaGoo is in the background; in the app the in-app toast shows them instead.
// Every function here does nothing in a build without expo-notifications (see ./native.js).

Notifications?.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

let channelsReady = null;
function ensureChannels() {
    if (Platform.OS !== "android" || !Notifications) return Promise.resolve();
    const { AndroidImportance } = Notifications;
    channelsReady ??= Promise.all([
        Notifications.setNotificationChannelAsync(CHANNELS.notifications.id, {
            name: CHANNELS.notifications.name,
            importance: AndroidImportance.HIGH,
            lightColor: "#DF6D26",
        }),
        Notifications.setNotificationChannelAsync(CHANNELS.bookingOffers.id, {
            name: CHANNELS.bookingOffers.name,
            importance: AndroidImportance.MAX,
            vibrationPattern: [0, 300, 200, 300],
            lightColor: "#DF6D26",
        }),
    ]).catch(() => {});
    return channelsReady;
}

// Asks once (Android 13+ / iOS). Returns whether phone notifications may be shown.
export async function requestNotificationPermission() {
    if (!Notifications) return false;
    try {
        await ensureChannels();
        const current = await Notifications.getPermissionsAsync();
        if (current.granted) return true;
        if (!current.canAskAgain) return false;
        return (await Notifications.requestPermissionsAsync()).granted;
    } catch {
        return false;
    }
}

async function show({ title, body, data, channelId }) {
    if (!Notifications) return;
    try {
        await ensureChannels();
        const { granted } = await Notifications.getPermissionsAsync();
        if (!granted) return;
        await Notifications.scheduleNotificationAsync({
            content: { title, body, data, sound: true, color: "#DF6D26" },
            trigger: Platform.OS === "android" ? { channelId } : null,
        });
    } catch (err) {
        console.log("Failed to show notification:", err?.message);
    }
}

// An app notification (same object as GET user/notifications/). Tapping it follows its redirect.
export function showAppNotification(notification) {
    return show({
        title: notificationStyle(notification.type).title,
        body: notification.message,
        data: { kind: "notification", notification },
        channelId: CHANNELS.notifications.id,
    });
}

export function showNotificationSummary(count) {
    return show({
        title: "TodaGoo",
        body: `You have ${count} new notifications.`,
        data: { kind: "notifications" },
        channelId: CHANNELS.notifications.id,
    });
}

// A booking offer to a ready driver while the app is in the background
export function showBookingOffer(booking) {
    const from = booking?.start_address;
    const to = booking?.end_address;
    return show({
        title: "New booking request",
        body: from && to ? `${from} → ${to}. Open TodaGoo to accept.` : "Open TodaGoo to accept it before it expires.",
        data: { kind: "booking_offer", bookingId: booking?.id ?? null },
        channelId: CHANNELS.bookingOffers.id,
    });
}

export async function setBadgeCount(count) {
    if (!Notifications) return;
    try {
        await Notifications.setBadgeCountAsync(count);
    } catch {}
}

// Newest notification id already shown or seen, so the background check never repeats one
export async function getLastNotifiedId() {
    const raw = await AsyncStorage.getItem(BG_KEYS.lastNotifiedId).catch(() => null);
    return raw == null ? null : Number(raw);
}

export async function markNotifiedUpTo(id) {
    if (id == null) return;
    const last = await getLastNotifiedId();
    if (last == null || id > last) await AsyncStorage.setItem(BG_KEYS.lastNotifiedId, String(id)).catch(() => {});
}
