// Passenger, end to end: register → log in → OTP → fare → book → driver accepts / picks up / completes
// → rate the driver → ride history. The app's own api/*.js, utils/requests.js, AuthContext and
// passenger socket listener run against the fake backend in ./fakeBackend.js.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { act, waitFor } from "@testing-library/react-native";
import { jwtDecode } from "jwt-decode";

import { createFakeBackend } from "./fakeBackend";
import {
    PLACES,
    as,
    applyOtpResponse,
    flush,
    quietConsole,
    registerAndLogin,
    renderAuth,
    renderPassengerSocket,
} from "./helpers";
import { passengerRegister, resendPassengerOtp, verifyPassengerOtp } from "../../api/passenger";
import { saveTokens, updateToken } from "../../api/auth";
import { bookRide, cancelBooking, getBookingHistory, getFarePrice } from "../../api/book";
import { createRate } from "../../api/rate";
import { ERROR_MESSAGES } from "../../constants/errors";
import { getStoredToken } from "../../utils/tokenStorage";
import newIdempotencyKey from "../../utils/idempotencyKey";
import { rideDistanceKm, rideDurationMin } from "../../utils/rideStats";

jest.mock("../../background", () => ({
    stopBackgroundWork: jest.fn(async () => {}),
    isAppInForeground: () => true,
    showBookingOffer: jest.fn(),
}));

const FORM = {
    username: "maria",
    password: "password123",
    first_name: "Maria",
    last_name: "Santos",
    email: "maria@example.com",
    passenger_profile: {
        contact_number: "09171234567",
        address: "Malolos, Bulacan",
        emergency_contact_name: "Jose Santos",
        emergency_contact_number: "09179876543",
    },
};

const BOOKING = {
    start: PLACES.pickup,
    start_address: "Malolos Cathedral",
    end: PLACES.dropoff,
    end_address: "Robinsons Malolos",
    stops: [{ location: PLACES.stop, address: "Capitol", order: 1 }],
    routes: [PLACES.pickup, PLACES.stop, PLACES.dropoff],
    type: "regular",
};

let backend;
let restoreConsole;
let unmounts;

beforeEach(async () => {
    restoreConsole = quietConsole();
    await AsyncStorage.clear();
    SecureStore.__store.clear();
    backend = createFakeBackend();
    unmounts = [];
});

afterEach(async () => {
    for (const unmount of unmounts) await act(() => unmount());
    restoreConsole();
});

// A registered, verified, logged-in passenger and an approved driver waiting in the queue
async function readyPassengerAndDriver() {
    const auth = await renderAuth();
    unmounts.push(auth.unmount);
    await registerAndLogin(auth, passengerRegister, FORM);
    await applyOtpResponse(auth, await verifyPassengerOtp({ otp: "123456" }), saveTokens);

    const { user: driver, tokens } = backend.seedUser({
        username: "pedro",
        role: "driver",
        first_name: "pedro",
        last_name: "reyes",
        profile: { contact_number: "09181112222", toda_number: "T-07", vehicle_plate: "TRY 123" },
    });
    const asDriver = as(backend, tokens);
    expect((await asDriver.post("booking/driver/queue", { lat: PLACES.pickup.lat, lng: PLACES.pickup.lng })).ok).toBe(true);
    const driverSocket = asDriver.socket(`ws/driver/${driver.id}`);
    await flush();

    const socket = await renderPassengerSocket(auth.result.current.user.user_id);
    unmounts.push(socket.unmount);
    return { auth, socket, driver, asDriver, driverSocket };
}

describe("passenger flow: happy path", () => {
    it("registers, verifies, books, rides, rates the driver and sees the ride in history", async () => {
        // ---- 1. register (register/passenger.jsx): sign up, then log in with the same details ----
        const auth = await renderAuth();
        unmounts.push(auth.unmount);
        expect(auth.result.current.user).toBeNull();

        const { register, login } = await registerAndLogin(auth, passengerRegister, FORM);
        expect(register).toMatchObject({ success: true, status: 201 });
        expect(register.data.passenger_profile.verified).toBe(false);
        expect(login.success).toBe(true);
        expect(auth.result.current.user).toMatchObject({ username: "maria", role: "passenger", verified: false });

        // the token is in the secure store (not AsyncStorage), the user in AsyncStorage
        expect(JSON.parse(await getStoredToken()).access).toBe(auth.result.current.token.access);
        expect(await AsyncStorage.getItem("token")).toBeNull();
        expect(JSON.parse(await AsyncStorage.getItem("user")).username).toBe("maria");

        // ---- 2. OTP (otp.jsx): the verify response carries a token that says verified ----
        const otp = await verifyPassengerOtp({ otp: "123456" });
        expect(otp.message).toBe("Passenger verified.");
        await applyOtpResponse(auth, otp, saveTokens);
        expect(auth.result.current.user.verified).toBe(true);
        expect(jwtDecode(JSON.parse(await getStoredToken()).access).verified).toBe(true);

        // a driver is online near the pickup point
        const { user: driver, tokens: driverTokens } = backend.seedUser({
            username: "pedro",
            role: "driver",
            first_name: "pedro",
            last_name: "reyes",
            profile: { contact_number: "09181112222", toda_number: "T-07", vehicle_plate: "TRY 123" },
        });
        const asDriver = as(backend, driverTokens);
        await asDriver.post("booking/driver/queue", { lat: PLACES.pickup.lat, lng: PLACES.pickup.lng });
        const driverSocket = asDriver.socket(`ws/driver/${driver.id}`);
        await flush();

        // ---- 3. the passenger's socket (PassengerContext) ----
        const passengerId = auth.result.current.user.user_id;
        const socket = await renderPassengerSocket(passengerId);
        unmounts.push(socket.unmount);
        expect(backend.sockets.get(`ws/passenger/${passengerId}`).protocols[0]).toBe("access_token");

        // ---- 4. fare estimate (hooks/useFareEstimate.js) ----
        const fare = await getFarePrice(PLACES.pickup, PLACES.dropoff, [PLACES.stop]);
        expect(fare).toBeGreaterThanOrEqual(20);

        // ---- 5. book (passenger/book.jsx) ----
        const key = newIdempotencyKey();
        const booking = await bookRide(BOOKING, key);
        expect(booking).toMatchObject({ status: "pending", start_address: "Malolos Cathedral", price: fare });
        expect(backend.requests.at(-1)).toMatchObject({ path: "booking/", idempotencyKey: key });

        // the backend offers it to the queued driver
        await flush();
        const offer = driverSocket.messages.find((m) => m.type === "new_booking");
        expect(offer.data.id).toBe(booking.id);

        // ---- 6. the driver accepts: the passenger's screen gets the driver ----
        await act(async () => driverSocket.send(JSON.stringify({ action: "accept_booking", booking_id: booking.id })));
        await waitFor(() => expect(socket.result.current.booking?.status).toBe("accepted"));
        expect(socket.result.current.booking.driver).toMatchObject({
            username: "pedro",
            toda_number: "T-07",
            vehicle_plate: "TRY 123",
        });

        // ---- 7. pickup and drop-off ----
        expect((await asDriver.put(`booking/${booking.id}/`, { status: "in_progress", location: PLACES.nearPickup })).ok).toBe(true);
        await waitFor(() => expect(socket.result.current.booking.status).toBe("in_progress"));
        expect((await asDriver.put(`booking/${booking.id}/`, { status: "completed" })).ok).toBe(true);
        await waitFor(() => expect(socket.result.current.booking.status).toBe("completed"));

        // receipt (passenger/complete.jsx)
        const done = socket.result.current.booking;
        expect(rideDistanceKm(done)).toBeGreaterThan(1);
        expect(rideDurationMin(done)).toBeGreaterThanOrEqual(1);

        // ---- 8. rate the driver (components/RateUser.jsx) ----
        const rate = await createRate({ booking_id: booking.id, user_id: driver.id, score: 5, feedback: "Safe ride" });
        expect(rate).toMatchObject({ booking: booking.id, user: driver.id, score: 5, feedback: "Safe ride" });
        expect(backend.user("pedro").rating).toBe(5);

        // ---- 9. ride history (history.jsx) ----
        const history = await getBookingHistory();
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({ id: booking.id, status: "completed" });
        expect(history[0].ratings).toEqual([{ rater: passengerId, user: driver.id, score: 5 }]);

        // every authenticated call carried the passenger's token
        const passengerToken = auth.result.current.token.access;
        const mine = backend.requests.filter((r) => ["booking/", "booking/rate/", "booking/history/"].includes(r.path));
        mine.forEach((r) => expect(r.auth).toBe(`Bearer ${passengerToken}`));
    });

    it("can cancel while still searching and book again", async () => {
        const { auth } = await readyPassengerAndDriver();
        backend.queue.clear(); // nobody to offer it to: it stays pending
        const first = await bookRide(BOOKING, newIdempotencyKey());
        await expect(cancelBooking(first.id)).resolves.toBe(true);
        expect(backend.bookings).toHaveLength(0);
        const second = await bookRide(BOOKING, newIdempotencyKey());
        expect(second.status).toBe("pending");
        expect(auth.result.current.user.username).toBe("maria");
    });

    it("a retried booking with the same idempotency key doesn't book twice", async () => {
        await readyPassengerAndDriver();
        const key = newIdempotencyKey();
        const first = await bookRide(BOOKING, key);
        const retry = await bookRide(BOOKING, key);
        expect(retry.id).toBe(first.id);
        expect(backend.bookings).toHaveLength(1);
    });

    it("a resent OTP replaces the old one", async () => {
        const auth = await renderAuth();
        unmounts.push(auth.unmount);
        await registerAndLogin(auth, passengerRegister, FORM);
        expect((await resendPassengerOtp()).message).toBe("A new OTP was sent.");
        expect((await verifyPassengerOtp({ otp: "123456" })).error).toBe("Invalid OTP.");
        expect((await verifyPassengerOtp({ otp: "654321" })).access).toBeTruthy();
    });

    it("a refreshed token keeps the passenger logged in", async () => {
        const auth = await renderAuth();
        unmounts.push(auth.unmount);
        await registerAndLogin(auth, passengerRegister, FORM);
        const before = auth.result.current.token.access;
        const logout = jest.fn();
        await act(() => updateToken(auth.result.current.setToken, auth.result.current.setUser, logout));
        expect(logout).not.toHaveBeenCalled();
        expect(auth.result.current.token.access).not.toBe(before);
        expect(JSON.parse(await getStoredToken()).access).toBe(auth.result.current.token.access);
    });
});

describe("passenger flow: errors", () => {
    describe("registration", () => {
        it("a taken username comes back as a validation error", async () => {
            await passengerRegister(FORM);
            const res = await passengerRegister({ ...FORM, passenger_profile: { ...FORM.passenger_profile } });
            expect(res).toMatchObject({ success: false, status: 400, kind: "validation", error: "A user with that username already exists." });
            expect(res.data.username).toEqual(["A user with that username already exists."]);
        });

        it("a short password is refused", async () => {
            const res = await passengerRegister({ ...FORM, password: "short" });
            expect(res.error).toBe("This password is too short. It must contain at least 8 characters.");
        });

        it("a profile field error is found inside the nested profile errors", async () => {
            const res = await passengerRegister({ ...FORM, passenger_profile: { ...FORM.passenger_profile, contact_number: "12345" } });
            expect(res).toMatchObject({ kind: "validation", error: "Enter a valid mobile number (09XXXXXXXXX)." });
        });

        it("a missing profile is refused", async () => {
            const { passenger_profile, ...noProfile } = FORM;
            expect((await passengerRegister(noProfile)).error).toBe("passenger_profile is required");
        });

        it("no connection: the screen doesn't log in", async () => {
            const auth = await renderAuth();
            unmounts.push(auth.unmount);
            backend.offlineNext();
            const { register, login } = await registerAndLogin(auth, passengerRegister, FORM);
            expect(register).toMatchObject({ success: false, kind: "network", error: ERROR_MESSAGES.network });
            expect(login).toBeNull();
            expect(backend.users).toHaveLength(0);
        });
    });

    describe("login", () => {
        it("a wrong password shows the server's message and saves nothing", async () => {
            await passengerRegister(FORM);
            const auth = await renderAuth();
            unmounts.push(auth.unmount);
            let res;
            await act(async () => {
                res = await auth.result.current.loginUser("maria", "wrong-password");
            });
            expect(res).toEqual({ success: false, error: "No active account found with the given credentials" });
            expect(auth.result.current.token).toBeNull();
            expect(await getStoredToken()).toBeNull();
        });

        it("no connection: a readable error, no crash", async () => {
            const auth = await renderAuth();
            unmounts.push(auth.unmount);
            backend.offlineNext();
            let res;
            await act(async () => {
                res = await auth.result.current.loginUser("maria", "password123");
            });
            expect(res.success).toBe(false);
            expect(auth.result.current.token).toBeNull();
        });
    });

    describe("OTP", () => {
        let auth;
        beforeEach(async () => {
            auth = await renderAuth();
            unmounts.push(auth.unmount);
            await registerAndLogin(auth, passengerRegister, FORM);
        });

        it("a wrong code is refused and the passenger stays unverified", async () => {
            const res = await verifyPassengerOtp({ otp: "000000" });
            expect(res).toEqual({ error: "Invalid OTP." });
            expect(res.access).toBeUndefined(); // otp.jsx shows res.error and stays on the screen
            expect(backend.user("maria").verified).toBe(false);
        });

        it("a code that isn't 6 digits is refused", async () => {
            expect((await verifyPassengerOtp({ otp: "12a" })).error).toBe("OTP must be 6 digits.");
        });

        it("locks after too many wrong codes, until a new one is requested", async () => {
            for (let i = 0; i < 5; i++) await verifyPassengerOtp({ otp: "000000" });
            expect((await verifyPassengerOtp({ otp: "123456" })).error).toBe("Too many wrong attempts. Request a new OTP.");
            await resendPassengerOtp();
            expect((await verifyPassengerOtp({ otp: "654321" })).access).toBeTruthy();
        });

        it("without a login token the request is refused", async () => {
            await act(() => auth.result.current.logoutUser());
            const res = await verifyPassengerOtp({ otp: "123456" });
            expect(res.detail).toBe("Authentication credentials were not provided.");
        });
    });

    describe("booking", () => {
        it("no driver online: the passenger is told, and can cancel", async () => {
            const { socket } = await readyPassengerAndDriver();
            backend.queue.clear();
            const booking = await bookRide(BOOKING, newIdempotencyKey());
            await waitFor(() => expect(socket.result.current.unavailable).toMatchObject({ booking_id: booking.id }));
            expect(socket.result.current.unavailable.message).toMatch(/No drivers are available/);
            await expect(cancelBooking(booking.id)).resolves.toBe(true);
        });

        it("a second booking while one is pending is refused with the server's reason", async () => {
            await readyPassengerAndDriver();
            await bookRide(BOOKING, newIdempotencyKey());
            await expect(bookRide(BOOKING, newIdempotencyKey())).rejects.toThrow("You already have an ongoing or pending booking.");
        });

        it("a booking without a destination is refused", async () => {
            await readyPassengerAndDriver();
            await expect(bookRide({ ...BOOKING, end: null }, newIdempotencyKey())).rejects.toThrow("Start and end locations are required");
        });

        it("a broken fare request shows the server's error", async () => {
            await readyPassengerAndDriver();
            await expect(getFarePrice({ lat: "x", lng: 1 }, PLACES.dropoff)).rejects.toThrow("Invalid coordinates format");
        });

        it("no connection while booking: the network message, nothing booked", async () => {
            await readyPassengerAndDriver();
            backend.offlineNext();
            await expect(bookRide(BOOKING, newIdempotencyKey())).rejects.toThrow(ERROR_MESSAGES.network);
            expect(backend.bookings).toHaveLength(0);
        });

        it("a ride a driver has accepted can't be cancelled", async () => {
            const { socket, driverSocket } = await readyPassengerAndDriver();
            const booking = await bookRide(BOOKING, newIdempotencyKey());
            await flush();
            await act(async () => driverSocket.send(JSON.stringify({ action: "accept_booking", booking_id: booking.id })));
            await waitFor(() => expect(socket.result.current.booking?.status).toBe("accepted"));
            await expect(cancelBooking(booking.id)).rejects.toThrow("Only pending bookings can be deleted.");
        });

        it("an expired session: every request says to log in again", async () => {
            await readyPassengerAndDriver();
            await SecureStore.setItemAsync("token", JSON.stringify({ access: "expired", refresh: "expired" }));
            await expect(bookRide(BOOKING, newIdempotencyKey())).rejects.toThrow(ERROR_MESSAGES.auth);
        });

        it("a rejected refresh token logs the passenger out; being offline doesn't", async () => {
            const { auth } = await readyPassengerAndDriver();
            const logout = jest.fn();
            backend.offlineNext();
            await act(() => updateToken(auth.result.current.setToken, auth.result.current.setUser, logout));
            expect(logout).not.toHaveBeenCalled();

            await SecureStore.setItemAsync("token", JSON.stringify({ access: "x", refresh: "revoked" }));
            await act(() => updateToken(auth.result.current.setToken, auth.result.current.setUser, logout));
            expect(logout).toHaveBeenCalledTimes(1);
        });
    });

    describe("rating", () => {
        // a completed ride with pedro
        async function completedRide() {
            const ctx = await readyPassengerAndDriver();
            const booking = await bookRide(BOOKING, newIdempotencyKey());
            await flush();
            await act(async () => ctx.driverSocket.send(JSON.stringify({ action: "accept_booking", booking_id: booking.id })));
            await waitFor(() => expect(ctx.socket.result.current.booking?.status).toBe("accepted"));
            return { ...ctx, booking };
        }

        it("can't rate a ride that hasn't finished", async () => {
            const { booking, driver } = await completedRide();
            const err = await createRate({ booking_id: booking.id, user_id: driver.id, score: 4 }).catch((e) => e);
            expect(err.message).toBe("You can only rate a completed ride.");
        });

        it("a score outside 1–5 comes back as a field error (RateUser shows it under the stars)", async () => {
            const { booking, driver, asDriver } = await completedRide();
            await asDriver.put(`booking/${booking.id}/`, { status: "in_progress", location: PLACES.nearPickup });
            await asDriver.put(`booking/${booking.id}/`, { status: "completed" });
            const err = await createRate({ booking_id: booking.id, user_id: driver.id, score: 0 }).catch((e) => e);
            expect(err.message).toBe("Ensure this value is between 1 and 5.");
            expect(err.data).toEqual({ score: ["Ensure this value is between 1 and 5."] });
        });

        it("can rate only once, and not themselves", async () => {
            const { booking, driver, asDriver, auth } = await completedRide();
            await asDriver.put(`booking/${booking.id}/`, { status: "in_progress", location: PLACES.nearPickup });
            await asDriver.put(`booking/${booking.id}/`, { status: "completed" });

            const self = await createRate({ booking_id: booking.id, user_id: auth.result.current.user.user_id, score: 5 }).catch((e) => e);
            expect(self.message).toBe("You cannot rate yourself");

            await createRate({ booking_id: booking.id, user_id: driver.id, score: 4 });
            const again = await createRate({ booking_id: booking.id, user_id: driver.id, score: 5 }).catch((e) => e);
            expect(again.message).toBe("You have already rated this booking");
            expect(again.data).toEqual(["You have already rated this booking"]);
            expect(backend.ratings).toHaveLength(1);
        });

        it("rating someone who wasn't in the ride is refused", async () => {
            const { booking, asDriver } = await completedRide();
            await asDriver.put(`booking/${booking.id}/`, { status: "in_progress", location: PLACES.nearPickup });
            await asDriver.put(`booking/${booking.id}/`, { status: "completed" });
            const stranger = backend.seedUser({ username: "stranger", role: "driver" }).user;
            const err = await createRate({ booking_id: booking.id, user_id: stranger.id, score: 1 }).catch((e) => e);
            expect(err.message).toBe("user_id is not a participant in this booking");
        });
    });
});
