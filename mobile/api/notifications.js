import { getRequest, patchRequest } from "../utils/requests";

export const getNotifications = async () => {
    const res = await getRequest('user/notifications/', {}, true)
    if (!res.success) throw new Error(res.error || "Failed to load notifications")
    return res.data;
}

export const markNotificationRead = async (id) => {
    const res = await patchRequest(`user/notifications/mark-as-read/${id}/`, {}, true)
    if (!res.success) throw new Error(res.error || "Failed to mark notification as read")
    return res.data;
}

export const markAllNotificationsRead = async () => {
    const res = await patchRequest('user/notifications/mark-all-as-read/', {}, true)
    if (!res.success) throw new Error(res.error || "Failed to mark notifications as read")
    return res.data;
}
