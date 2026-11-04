import { useSyncExternalStore } from "react";

// Whether the driver is in the queue ("Online") — set by the driver home after the queue status
// check / Ready / Go Offline. null = not known yet (header hides the status).
let online = null;
const listeners = new Set();

export function setDriverOnline(value) {
    if (value === online) return;
    online = value;
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useDriverOnline() {
    return useSyncExternalStore(subscribe, () => online);
}
