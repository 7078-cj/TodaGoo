import { useSyncExternalStore } from "react";

// Whether the logged-in passenger or driver has a ride in progress (accepted / in_progress).
// Published by PassengerContext / DriverContext; the bottom nav lives outside both providers, so it
// reads it from here to enable the Booking tab and send it to the trip screen.
const ACTIVE_STATUSES = ["accepted", "in_progress"];

let hasActiveBooking = false;
const listeners = new Set();

export function setActiveBooking(booking) {
    const next = ACTIVE_STATUSES.includes(booking?.status);
    if (next === hasActiveBooking) return;
    hasActiveBooking = next;
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useHasActiveBooking() {
    return useSyncExternalStore(subscribe, () => hasActiveBooking);
}
