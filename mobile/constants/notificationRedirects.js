import { router } from "expo-router";
import { requestChat } from "../utils/chatRequestStore";

// Where tapping a notification takes the user. One entry per notification `type`
// (backend: Notification.Type in api/features/user/models.py).
//
//   type          – notification type from the backend
//   path          – route per role ({ passenger, driver }); a role without a path isn't redirected.
//                   null = never redirect.
//   openChat      – (optional) also open the chat modal for the notification's booking on arrival
//                   (see utils/chatRequestStore.js + hooks/useOpenChatParam.js)
//   activeRideOnly – only redirect while the notification's booking is still active,
//                   so old notifications don't open the trip screen of a finished ride.
export const NOTIFICATION_REDIRECTS = [
    {
        type: "booking_accepted",
        path: { passenger: "/(protected)/passenger/en_route" },
        activeRideOnly: true,
    },
    {
        type: "driver_nearby",
        path: { passenger: "/(protected)/passenger/en_route" },
        activeRideOnly: true,
    },
    {
        type: "new_message",
        path: {
            passenger: "/(protected)/passenger/en_route",
            driver: "/(protected)/driver/en_route",
        },
        openChat: true,
        activeRideOnly: true,
    },
    {
        // reports: no redirect for now
        type: "reported",
        path: null,
    },
    {
        type: "general",
        path: null,
    },
];

const ACTIVE_BOOKING_STATUSES = ["accepted", "in_progress"];

// The redirect ({ pathname, openChat }) for `notification` as `role`,
// or null to stay on the notifications screen
export function getNotificationRedirect(notification, role) {
    const entry = NOTIFICATION_REDIRECTS.find((r) => r.type === notification?.type);
    const path = entry?.path?.[role];
    if (!path) return null;

    if (entry.activeRideOnly && !ACTIVE_BOOKING_STATUSES.includes(notification.booking_status)) {
        return null;
    }

    return { pathname: path, openChat: !!entry.openChat };
}

// Whether `pathname` (e.g. "/(protected)/driver/en_route") is anywhere in the navigation stack.
// Walks the nested navigators segment by segment: "(protected)" → "driver" → "en_route".
function isInStack(state, pathname) {
    const segments = pathname.split("/").filter(Boolean);
    let routes = state?.routes;

    for (const segment of segments) {
        const route = routes?.find((r) => r.name === segment);
        if (!route) return false;
        routes = route.state?.routes;
    }
    return true;
}

// Follow a tapped notification. Returns false when its type has no redirect.
// `rootState` comes from useRootNavigationState(). If the screen is already in the stack we go
// back to it (dismissTo) instead of pushing a second copy on top. Otherwise we push it.
export function followNotification(notification, role, rootState) {
    const redirect = getNotificationRedirect(notification, role);
    if (!redirect) return false;

    if (redirect.openChat) requestChat(notification.booking_id);

    if (isInStack(rootState, redirect.pathname)) router.dismissTo(redirect.pathname);
    else router.push(redirect.pathname);
    return true;
}
