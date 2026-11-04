import { useEffect, useRef } from "react";
import { Notifications } from "../background/native";
import { router, useRootNavigationState } from "expo-router";
import { useNotifications } from "../contexts/NotificationContext";
import { useProfile } from "../contexts/ProfileContext";
import { followNotification } from "../constants/notificationRedirects";
import { goTo } from "../utils/navigation";

// Tapping a phone notification (background/localNotifications.js) opens the same place as
// tapping it in the app. Also handles the tap that launched the app from closed.

// fixed for the app's lifetime (the native module is there or not), so the hook order never changes
const useLastNotificationResponse = Notifications?.useLastNotificationResponse ?? (() => null);
export default function useNotificationTaps() {
    const response = useLastNotificationResponse();
    const { markRead } = useNotifications();
    const { role } = useProfile();
    const rootState = useRootNavigationState();
    const handled = useRef(new Set());

    useEffect(() => {
        // wait for the navigator and the role, or the redirect has nowhere to go
        if (!response || !role || !rootState?.key) return;
        const id = response.notification.request.identifier;
        if (handled.current.has(id)) return;
        handled.current.add(id);

        const data = response.notification.request.content.data ?? {};
        if (data.kind === "notification" && data.notification) {
            if (followNotification(data.notification, role, rootState)) markRead(data.notification.id);
        } else if (data.kind === "booking_offer") {
            // the offer card shows on the driver home while it's still open
            goTo("/(protected)/driver/home", rootState);
        } else if (data.kind === "notifications") {
            router.push("/notifications");
        }
        Notifications?.clearLastNotificationResponse();
    }, [response, role, rootState, markRead]);
}
