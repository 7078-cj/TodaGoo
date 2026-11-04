// Background work while TodaGoo is minimized or closed. Imported once from app/_layout.jsx so the
// tasks are defined before the OS asks for them (it may start the app headless to run one).
//
//   Driver location     background/driverLocationTask.js    during an active ride (DriverContext)
//   Notification check  background/notificationSyncTask.js  ~every 15 min while logged in
//   Phone notifications background/localNotifications.js    new notifications / booking offers while
//                                                            the app is in the background; taps are
//                                                            handled by hooks/useNotificationTaps.js
//
// Needs a development / production build that includes the native modules. In an older build or
// Expo Go they aren't loaded (background/native.js) and these features simply stay off.
import { AppState } from "react-native";
import { stopDriverLocationUpdates } from "./driverLocationTask";
import { registerNotificationSync, unregisterNotificationSync } from "./notificationSyncTask";
import { requestNotificationPermission } from "./localNotifications";

export { startDriverLocationUpdates, stopDriverLocationUpdates, isDriverLocationTaskRunning } from "./driverLocationTask";
export { showAppNotification, showBookingOffer, markNotifiedUpTo, setBadgeCount } from "./localNotifications";

export const isAppInForeground = () => AppState.currentState === "active";

// Logged in: ask for notification permission and schedule the notification check
export async function startBackgroundWork() {
    await requestNotificationPermission();
    await registerNotificationSync();
}

// Logged out: nothing keeps running for the previous user
export async function stopBackgroundWork() {
    await Promise.all([stopDriverLocationUpdates(), unregisterNotificationSync()]);
}
