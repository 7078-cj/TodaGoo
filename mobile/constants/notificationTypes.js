// How each notification `type` (from the backend) looks in the notifications list.
// To add a type: add an entry here (and a redirect in constants/notificationRedirects.js).
//   title – bold first line of the card
//   icon  – Ionicons name, drawn white on a `color` circle
export const NOTIFICATION_TYPES = {
    booking_accepted: { title: "Booking Accepted", icon: "checkmark", color: "#16A34A" },
    driver_nearby: { title: "Driver Nearby", icon: "location-outline", color: "#3B82F6" },
    new_message: { title: "New Message", icon: "chatbubble-ellipses-outline", color: "#8B5CF6" },
    reported: { title: "You Were Reported", icon: "alert", color: "#DC2626" },
    report_update: { title: "Report Update", icon: "document-text-outline", color: "#EAB308" },
    general: { title: "Notification", icon: "notifications-outline", color: "#DF6D26" },
};

export function notificationStyle(type) {
    return NOTIFICATION_TYPES[type] ?? NOTIFICATION_TYPES.general;
}
