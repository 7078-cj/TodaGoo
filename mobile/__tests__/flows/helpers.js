// Shared pieces for the flow tests: the app's real AuthProvider and socket listeners, rendered as hooks,
// plus a way to act as the other person in the ride (straight against the fake backend).
import React, { useContext, useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AuthContext, { AuthProvider } from "../../contexts/AuthContext";
import passengerListener from "../../listeners/passengerListener";
import driverListener from "../../listeners/driverListener";

// Sockets and the token refresh log to the console; keep the test output readable
export function quietConsole() {
    const spies = ["log", "warn", "error"].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    return () => spies.forEach((s) => s.mockRestore());
}

// AuthContext as the screens see it (login.jsx, register/*.jsx, otp.jsx)
export async function renderAuth() {
    const hook = await renderHook(() => useContext(AuthContext), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });
    await waitFor(() => expect(hook.result.current.authHydrated).toBe(true));
    return hook;
}

// What register/passenger.jsx and register/driver.jsx do on Submit:
// register → log in with the same username / password → (screen goes to /otp)
export async function registerAndLogin(auth, registerFn, form) {
    const res = await registerFn(form);
    if (!res.success) return { register: res, login: null };
    let login;
    await act(async () => {
        login = await auth.result.current.loginUser(form.username, form.password);
    });
    return { register: res, login };
}

// What otp.jsx does with a verify response: store the new tokens in AuthContext (and storage)
export async function applyOtpResponse(auth, data, saveTokens) {
    await act(async () => {
        await saveTokens(
            { access: data.access, refresh: data.refresh },
            auth.result.current.setToken,
            auth.result.current.setUser
        );
    });
}

// PassengerContext's socket: the booking the passenger is following, and "no driver" messages
export async function renderPassengerSocket(userId) {
    const hook = await renderHook(() => {
        const [booking, setBooking] = useState(null);
        const [unavailable, setUnavailable] = useState(null);
        const conn = passengerListener(userId, undefined, setBooking, setUnavailable);
        return { booking, unavailable, ...conn };
    });
    await waitFor(() => expect(hook.result.current.connected).toBe(true));
    return hook;
}

// DriverContext's socket: the offer on screen and the accepted ride
export async function renderDriverSocket(userId) {
    const hook = await renderHook(() => {
        const [pending, setPending] = useState(null);
        const [accepted, setAccepted] = useState(null);
        const conn = driverListener(userId, undefined, setPending, setAccepted);
        return { pending, accepted, ...conn };
    });
    await waitFor(() => expect(hook.result.current.connected).toBe(true));
    return hook;
}

// Requests as someone else (the other side of the ride), without touching this device's stored token
export function as(backend, tokens) {
    const call = async (method, path, body, idempotencyKey) => {
        const res = await backend.fetch(path, {
            method,
            headers: {
                Authorization: `Bearer ${tokens.access}`,
                "Content-Type": "application/json",
                ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const data = res.status === 204 ? null : await res.json().catch(() => null);
        return { status: res.status, ok: res.ok, data };
    };
    return {
        get: (path) => call("GET", path),
        post: (path, body) => call("POST", path, body),
        put: (path, body) => call("PUT", path, body),
        del: (path) => call("DELETE", path),
        // a socket for the other person, e.g. the driver accepting the passenger's booking
        socket(path) {
            const socket = new backend.WebSocket(`ws://localhost:8000/${path}`, ["access_token", tokens.access]);
            socket.messages = [];
            socket.onmessage = (e) => socket.messages.push(JSON.parse(e.data));
            return socket;
        },
    };
}

// let the fake backend's "after commit" work (driver assignment, socket pushes) run
export const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));

// Places in Malolos, Bulacan
export const PLACES = {
    pickup: { lat: 14.8433, lng: 120.8114 },
    dropoff: { lat: 14.8527, lng: 120.8160 },
    stop: { lat: 14.8480, lng: 120.8130 },
    // ~100 m north of the pickup point (inside the 150 m pickup radius)
    nearPickup: { latitude: 14.8442, longitude: 120.8114 },
    // ~1.1 km north of it
    farFromPickup: { latitude: 14.8533, longitude: 120.8114 },
};

export const photo = (name) => ({ uri: `file:///photos/${name}.jpg`, fileName: `${name}.jpg`, mimeType: "image/jpeg" });
