import { getRequest, patchRequest, postRequest, deleteRequest } from "../utils/requests";

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

export const deleteNotification = async (id) => {
    const res = await deleteRequest(`user/notifications/${id}/`, true)
    if (!res.success) throw new Error(res.error || "Failed to delete the notification")
    return true;
}

// Deletes several at once; returns the ids actually deleted (only your own are)
export const deleteNotifications = async (ids) => {
    const res = await postRequest('user/notifications/delete/', { ids }, true)
    if (!res.success) throw new Error(res.error || "Failed to delete notifications")
    return res.data?.deleted ?? [];
}
