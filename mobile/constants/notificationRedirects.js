// Where tapping a notification takes the user. One entry per notification `type`
// (backend: Notification.Type in api/features/user/models.py).
//
//   type          – notification type from the backend
//   path          – route per role ({ passenger, driver }); a role without a path isn't redirected.
//                   null = never redirect.
//   params        – (optional) route params passed along, e.g. { openChat: "1" } makes the
//                   trip screen open the chat modal (see hooks/useOpenChatParam.js)
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
        params: { openChat: "1" },
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

// The href ({ pathname, params }) to open for `notification` as `role`,
// or null to stay on the notifications screen
export function getNotificationRedirect(notification, role) {
    const entry = NOTIFICATION_REDIRECTS.find((r) => r.type === notification?.type);
    const path = entry?.path?.[role];
    if (!path) return null;

    if (entry.activeRideOnly && !ACTIVE_BOOKING_STATUSES.includes(notification.booking_status)) {
        return null;
    }

    return { pathname: path, params: entry.params ?? {} };
}
