import { BackgroundTask, TaskManager } from "./native";
import { getRequest } from "../utils/requests";
import { getAccessToken } from "./auth";
import { MAX_INDIVIDUAL_NOTIFICATIONS, NOTIFICATION_SYNC_MINUTES, NOTIFICATION_SYNC_TASK } from "./config";
import {
    getLastNotifiedId,
    markNotifiedUpTo,
    setBadgeCount,
    showAppNotification,
    showNotificationSummary,
} from "./localNotifications";

// Checks for new notifications while TodaGoo is closed and shows them as phone notifications.
// The live socket covers the app while it's open; this catches what arrived after it closed.
export async function syncNotifications() {
    // logged out, or the session can't be refreshed: nothing to check
    if (!(await getAccessToken())) return;

    const res = await getRequest("user/notifications/", {}, true);
    if (!res.success || !Array.isArray(res.data)) return;

    const list = res.data;
    const unread = list.filter((n) => !n.read);
    await setBadgeCount(unread.length);

    const newestId = list.reduce((max, n) => Math.max(max, n.id), 0) || null;
    const last = await getLastNotifiedId();
    // first check on this device: start from now instead of announcing old ones
    if (last == null) {
        await markNotifiedUpTo(newestId);
        return;
    }

    const fresh = unread.filter((n) => n.id > last).sort((a, b) => a.id - b.id);
    if (fresh.length > MAX_INDIVIDUAL_NOTIFICATIONS) await showNotificationSummary(fresh.length);
    else for (const n of fresh) await showAppNotification(n);

    await markNotifiedUpTo(newestId);
}

// Module scope on purpose: the OS can start the app headless just to run this
TaskManager?.defineTask(NOTIFICATION_SYNC_TASK, async () => {
    try {
        await syncNotifications();
        return BackgroundTask?.BackgroundTaskResult.Success;
    } catch (err) {
        console.log("Notification sync failed:", err?.message);
        return BackgroundTask?.BackgroundTaskResult.Failed;
    }
});

export async function registerNotificationSync() {
    if (!TaskManager || !BackgroundTask) return false;
    try {
        const status = await BackgroundTask.getStatusAsync();
        if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
        if (await TaskManager.isTaskRegisteredAsync(NOTIFICATION_SYNC_TASK)) return true;
        await BackgroundTask.registerTaskAsync(NOTIFICATION_SYNC_TASK, { minimumInterval: NOTIFICATION_SYNC_MINUTES });
        return true;
    } catch (err) {
        console.log("Background notification check unavailable:", err?.message);
        return false;
    }
}

export async function unregisterNotificationSync() {
    if (!TaskManager || !BackgroundTask) return;
    try {
        if (await TaskManager.isTaskRegisteredAsync(NOTIFICATION_SYNC_TASK)) {
            await BackgroundTask.unregisterTaskAsync(NOTIFICATION_SYNC_TASK);
        }
    } catch {}
}
