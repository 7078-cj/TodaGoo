import { useSyncExternalStore } from "react";

// Whether the driver has a ride in progress (accepted / in_progress), published by DriverContext.
// The bottom nav lives outside DriverProvider, so it reads it from here.
const ACTIVE_STATUSES = ["accepted", "in_progress"];

let hasActiveBooking = false;
const listeners = new Set();

export function setDriverActiveBooking(booking) {
    const next = ACTIVE_STATUSES.includes(booking?.status);
    if (next === hasActiveBooking) return;
    hasActiveBooking = next;
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useDriverHasActiveBooking() {
    return useSyncExternalStore(subscribe, () => hasActiveBooking);
}
