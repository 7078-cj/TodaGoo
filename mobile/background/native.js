import { requireOptionalNativeModule } from "expo";

// The background packages need their native code in the installed app. An app built before they
// were added (or Expo Go) doesn't have it, and importing them there throws
// "Cannot find native module ..." at startup, crashing the whole app.
// So they're loaded only when their native modules exist; otherwise they're null and every
// background feature quietly turns off until the app is rebuilt (npx expo run:android / EAS).

const hasNative = (names) => names.every((name) => requireOptionalNativeModule(name) != null);

function load(nativeNames, loader) {
    if (!hasNative(nativeNames)) return null;
    try {
        return loader();
    } catch (err) {
        console.log("Background module unavailable:", err?.message);
        return null;
    }
}

export const Notifications = load(
    // expo-notifications loads expo-application too (for push tokens)
    ["ExpoApplication", "ExpoNotificationPresenter", "ExpoNotificationScheduler", "ExpoNotificationsEmitter"],
    () => require("expo-notifications")
);
export const TaskManager = load(["ExpoTaskManager"], () => require("expo-task-manager"));
export const BackgroundTask = TaskManager ? load(["ExpoBackgroundTask"], () => require("expo-background-task")) : null;

if (!Notifications || !TaskManager || !BackgroundTask) {
    console.log("Background features are off in this build. Rebuild the app (npx expo run:android) to turn them on.");
}
