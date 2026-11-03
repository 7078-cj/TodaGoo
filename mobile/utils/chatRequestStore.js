import { useSyncExternalStore } from "react";

// "Open the chat for booking X", set by a tapped message notification.
// Kept here instead of in route params or screen state so it survives the trip screen
// re-rendering or remounting after the redirect; cleared only when the user closes the chat.
let requestedBookingId = null;
const listeners = new Set();

function emit() {
    listeners.forEach((listener) => listener());
}

export function requestChat(bookingId) {
    requestedBookingId = bookingId;
    emit();
}

export function clearChatRequest() {
    if (requestedBookingId === null) return;
    requestedBookingId = null;
    emit();
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

// true while a chat was requested for this booking and hasn't been closed yet
export function useChatRequested(bookingId) {
    const requested = useSyncExternalStore(subscribe, () => requestedBookingId);
    return bookingId != null && requested === bookingId;
}
