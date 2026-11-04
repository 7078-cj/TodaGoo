import { getAccessToken } from "./auth";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || "ws://localhost:8000";
const OPEN_TIMEOUT_MS = 8000;
// booking socket close codes meaning "this ride is no longer yours" (see backend websocket/features/booking.py)
const NOT_ALLOWED_CODES = [4003, 4004];

// One socket to ws/booking/<id> for the background location task, kept open between updates.
// Separate from the screen's socket (useWebSocket), which only lives while the app is in use.
let socket = null;
let socketBookingId = null;
let lastCloseCode = null;

function open(bookingId, access) {
    return new Promise((resolve) => {
        const ws = new WebSocket(`${WS_URL}ws/booking/${bookingId}`, ["access_token", access]);
        const timer = setTimeout(() => {
            ws.close();
            resolve(null);
        }, OPEN_TIMEOUT_MS);

        ws.onopen = () => {
            clearTimeout(timer);
            resolve(ws);
        };
        ws.onerror = () => {};
        ws.onclose = (event) => {
            clearTimeout(timer);
            lastCloseCode = event.code;
            if (socket === ws) socket = null;
            resolve(null);
        };
        // chat / location echoes aren't needed in the background
        ws.onmessage = () => {};
    });
}

/**
 * Send { action: "driver_location", location } for the ride.
 * Returns "sent", "failed" (try again next update) or "not_allowed" (stop: the ride isn't the driver's anymore).
 */
export async function sendDriverLocation(bookingId, location) {
    const id = String(bookingId);

    if (!socket || socket.readyState !== WebSocket.OPEN || socketBookingId !== id) {
        closeLocationSocket();
        const access = await getAccessToken();
        if (!access) return "not_allowed"; // logged out

        lastCloseCode = null;
        socket = await open(id, access);
        socketBookingId = socket ? id : null;
        if (!socket) return NOT_ALLOWED_CODES.includes(lastCloseCode) ? "not_allowed" : "failed";
    }

    try {
        socket.send(JSON.stringify({ action: "driver_location", location }));
        return "sent";
    } catch {
        closeLocationSocket();
        return "failed";
    }
}

export function closeLocationSocket() {
    if (socket) {
        const ws = socket;
        socket = null;
        ws.onclose = null;
        ws.close();
    }
    socketBookingId = null;
}
