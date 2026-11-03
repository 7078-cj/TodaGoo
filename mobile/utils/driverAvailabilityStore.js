import { useSyncExternalStore } from "react";

// Number of drivers in the queue, pushed by the passenger socket.
// null = not known yet (socket not connected), so the UI stays enabled.
let readyDrivers = null;
const listeners = new Set();

export function setReadyDrivers(count) {
    readyDrivers = count;
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useReadyDrivers() {
    return useSyncExternalStore(subscribe, () => readyDrivers);
}

export function useNoDriversAvailable() {
    return useReadyDrivers() === 0;
}
