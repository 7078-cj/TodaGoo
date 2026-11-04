import { Alert } from "react-native";
import * as Location from "expo-location";
import { TaskManager } from "./native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BG_KEYS, DRIVER_LOCATION_OPTIONS, DRIVER_LOCATION_TASK } from "./config";
import { closeLocationSocket, sendDriverLocation } from "./locationSocket";

// Safety stop: a ride left "active" (app killed before it was completed) doesn't track forever
const MAX_RIDE_TRACKING_MS = 4 * 60 * 60 * 1000;

async function readActiveRide() {
    try {
        const raw = await AsyncStorage.getItem(BG_KEYS.driverBookingId);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

// Runs for every location update, including while the app is minimized or closed (Android
// restarts the JS runtime for it). Must be defined at module scope; imported from app/_layout.jsx.
TaskManager?.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.log("Background location error:", error.message);
        return;
    }
    const latest = data?.locations?.[data.locations.length - 1];
    if (!latest) return;

    const ride = await readActiveRide();
    if (!ride?.bookingId || Date.now() - ride.startedAt > MAX_RIDE_TRACKING_MS) {
        await stopDriverLocationUpdates();
        return;
    }

    const result = await sendDriverLocation(ride.bookingId, {
        coords: { latitude: latest.coords.latitude, longitude: latest.coords.longitude },
    });
    if (result === "not_allowed") await stopDriverLocationUpdates();
});

export async function isDriverLocationTaskRunning() {
    // background location runs through expo-task-manager; without it nothing was started
    if (!TaskManager) return false;
    try {
        return await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    } catch {
        return false;
    }
}

function confirm(title, message) {
    return new Promise((resolve) =>
        Alert.alert(title, message, [
            { text: "Not now", style: "cancel", onPress: () => resolve(false) },
            { text: "Continue", onPress: () => resolve(true) },
        ], { cancelable: true, onDismiss: () => resolve(false) })
    );
}

// "Allow all the time" location. Asked once per ride, with a short explanation first
// (Android opens the system settings page for it).
async function ensureBackgroundPermission(bookingId) {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") {
        const asked = await Location.requestForegroundPermissionsAsync();
        if (asked.status !== "granted") return false;
    }

    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === "granted") return true;
    if (!bg.canAskAgain) return false;

    const askedFor = await AsyncStorage.getItem(BG_KEYS.locationAskedFor);
    if (askedFor === String(bookingId)) return false;
    await AsyncStorage.setItem(BG_KEYS.locationAskedFor, String(bookingId));

    const ok = await confirm(
        "Keep sharing your location?",
        'So your passenger can still see you when TodaGoo is in the background, allow location "All the time" on the next screen.'
    );
    if (!ok) return false;

    const result = await Location.requestBackgroundPermissionsAsync();
    return result.status === "granted";
}

/**
 * Start reporting the driver's location for this ride, even with the app closed.
 * Returns false when background location isn't allowed (the en-route screen still sends while open).
 */
export async function startDriverLocationUpdates(bookingId) {
    if (!bookingId || !TaskManager) return false;
    try {
        const current = await readActiveRide();
        const sameRide = String(current?.bookingId) === String(bookingId);
        await AsyncStorage.setItem(
            BG_KEYS.driverBookingId,
            JSON.stringify({ bookingId, startedAt: sameRide ? current.startedAt : Date.now() })
        );

        if (sameRide && (await isDriverLocationTaskRunning())) return true;
        if (!(await ensureBackgroundPermission(bookingId))) return false;

        await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, DRIVER_LOCATION_OPTIONS);
        return true;
    } catch (err) {
        // e.g. Expo Go, which has no background location
        console.log("Background location unavailable:", err?.message);
        return false;
    }
}

// Ride ended / logged out
export async function stopDriverLocationUpdates() {
    try {
        await AsyncStorage.removeItem(BG_KEYS.driverBookingId);
        if (await isDriverLocationTaskRunning()) {
            await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
        }
    } catch (err) {
        console.log("Failed to stop background location:", err?.message);
    } finally {
        closeLocationSocket();
    }
}
