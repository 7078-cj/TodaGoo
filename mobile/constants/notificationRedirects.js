import { goTo } from "../utils/navigation";
import { requestChat } from "../utils/chatRequestStore";
import { requestReport } from "../utils/reportRequestStore";

// Where tapping a notification takes the user. One entry per notification `type`
// (backend: Notification.Type in api/features/user/models.py).
//
//   type          – notification type from the backend
//   path          – route per role ({ passenger, driver }); a role without a path isn't redirected.
//                   null = never redirect.
//   openChat      – (optional) also open the chat modal for the notification's booking on arrival
//                   (see utils/chatRequestStore.js + hooks/useOpenChatParam.js)
//   openReport    – (optional) open Profile → Reports with the notification's report in its modal
//                   ("limited" = the report is about the user: limited view without the reporter's account)
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
        // "Your report was resolved / dismissed": your own report in full
        type: "report_update",
        path: { passenger: "/(protected)/profile", driver: "/(protected)/profile" },
        openReport: true,
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

    return { pathname: path, openChat: !!entry.openChat, openReport: !!entry.openReport };
}

// Follow a tapped notification. Returns false when its type has no redirect.
// `rootState` comes from useRootNavigationState(); goTo() never stacks a second copy of the screen
// or of its driver / passenger layout.
export function followNotification(notification, role, rootState) {
    const redirect = getNotificationRedirect(notification, role);
    if (!redirect) return false;

    if (redirect.openChat) requestChat(notification.booking_id);
    if (redirect.openReport) requestReport(notification.report_id);

    goTo(redirect.pathname, rootState);
    return true;
}
