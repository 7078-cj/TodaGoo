// Driver, end to end: register (with photos) → log in → OTP → TODA approval → go online → booking offer
// → accept → pick up → complete → rate the passenger → earnings / history / go offline.
// The app's own api/*.js, utils/requests.js, AuthContext and driver socket listener run against the
// fake backend in ./fakeBackend.js.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { act, waitFor } from "@testing-library/react-native";

import { createFakeBackend } from "./fakeBackend";
import {
    PLACES,
    as,
    applyOtpResponse,
    flush,
    photo,
    quietConsole,
    registerAndLogin,
    renderAuth,
    renderDriverSocket,
} from "./helpers";
import {
    driverDequeue,
    driverQueue,
    driverQueueStatus,
    driverRegister,
    getDriverEarnings,
    verifyDriverOtp,
} from "../../api/driver";
import { saveTokens } from "../../api/auth";
import { completeBooking, getBookingHistory, inProgressBooking } from "../../api/book";
import { createRate } from "../../api/rate";
import { ERROR_MESSAGES } from "../../constants/errors";
import { isNearPickup } from "../../utils/pickupProximity";
import { getPerson } from "../../utils/person";
import newIdempotencyKey from "../../utils/idempotencyKey";

jest.mock("../../background", () => ({
    stopBackgroundWork: jest.fn(async () => {}),
    isAppInForeground: () => true,
    showBookingOffer: jest.fn(),
}));

const FORM = {
    username: "pedro",
    password: "password123",
    first_name: "Pedro",
    last_name: "Reyes",
    email: "pedro@example.com",
    driver_profile: {
        contact_number: "09181112222",
        address: "Malolos, Bulacan",
        toda_number: "T-07",
        vehicle_plate: "TRY 123",
        profile_picture: photo("profile"),
        vehicle_front_picture: photo("front"),
        vehicle_back_picture: photo("back"),
    },
};

const RIDE = {
    start: PLACES.pickup,
    start_address: "Malolos Cathedral",
    end: PLACES.dropoff,
    end_address: "Robinsons Malolos",
    stops: [],
    routes: [PLACES.pickup, PLACES.dropoff],
    type: "regular",
};

const QUEUE_SPOT = { lat: PLACES.pickup.lat, lng: PLACES.pickup.lng };

let backend;
let restoreConsole;
let unmounts;
let alert;

beforeEach(async () => {
    restoreConsole = quietConsole();
    alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await AsyncStorage.clear();
    SecureStore.__store.clear();
    backend = createFakeBackend();
    unmounts = [];
});

afterEach(async () => {
    for (const unmount of unmounts) await act(() => unmount());
    alert.mockRestore();
    restoreConsole();
});

// A passenger on the other side, booking straight against the backend
function seedPassenger(username = "maria") {
    const { user, tokens } = backend.seedUser({
        username,
        role: "passenger",
        first_name: "maria",
        last_name: "santos",
        profile: { contact_number: "09171234567" },
    });
    return { passenger: user, asPassenger: as(backend, tokens) };
}

// A registered, verified, approved driver, logged in, with the driver socket open
async function readyDriver({ online = true } = {}) {
    const auth = await renderAuth();
    unmounts.push(auth.unmount);
    await registerAndLogin(auth, driverRegister, FORM);
    await applyOtpResponse(auth, await verifyDriverOtp({ otp: "123456" }), saveTokens);
    backend.approveDriver("pedro");
    const socket = await renderDriverSocket(auth.result.current.user.user_id);
    unmounts.push(socket.unmount);
    if (online) await driverQueue(QUEUE_SPOT);
    return { auth, socket, driverId: auth.result.current.user.user_id };
}

// readyDriver + a passenger's booking offered to them
async function offered() {
    const ctx = await readyDriver();
    const { passenger, asPassenger } = seedPassenger();
    const { data: booking } = await asPassenger.post("booking/", RIDE);
    await waitFor(() => expect(ctx.socket.result.current.pending?.id).toBe(booking.id));
    return { ...ctx, passenger, asPassenger, booking };
}

// offered + accepted
async function accepted() {
    const ctx = await offered();
    await act(async () => ctx.socket.result.current.acceptBooking(ctx.booking.id));
    await waitFor(() => expect(ctx.socket.result.current.accepted?.status).toBe("accepted"));
    return ctx;
}

describe("driver flow: happy path", () => {
    it("registers, gets approved, takes a booking, finishes the ride, rates the passenger and is paid", async () => {
        // ---- 1. register (register/driver.jsx): the photos go up as multipart ----
        const auth = await renderAuth();
        unmounts.push(auth.unmount);
        const { register, login } = await registerAndLogin(auth, driverRegister, FORM);
        expect(register).toMatchObject({ success: true, status: 201 });
        const signup = backend.requests.find((r) => r.path === "driver/");
        expect(signup.body.__multipart).toBe(true);
        expect(signup.body.driver_profile).toMatchObject({ contact_number: "09181112222", vehicle_plate: "TRY 123" });
        expect(login.success).toBe(true);
        expect(auth.result.current.user).toMatchObject({ username: "pedro", role: "driver", verified: false });

        // ---- 2. OTP (otp.jsx) ----
        const otp = await verifyDriverOtp({ otp: "123456" });
        expect(otp.message).toBe("Driver verified.");
        await applyOtpResponse(auth, otp, saveTokens);
        expect(auth.result.current.user.verified).toBe(true);

        // ---- 3. a TODA admin approves the driver (dashboard) ----
        backend.approveDriver("pedro");

        // ---- 4. driver home: socket open, go online ("Ready") ----
        const driverId = auth.result.current.user.user_id;
        const socket = await renderDriverSocket(driverId);
        unmounts.push(socket.unmount);
        expect(await driverQueueStatus()).toMatchObject({ ready: false, en_route: false });
        expect(await driverQueue(QUEUE_SPOT)).toMatchObject({ driver_id: driverId });
        expect(await driverQueueStatus()).toMatchObject({ ready: true });

        // ---- 5. a passenger books: the offer pops up ----
        const { passenger, asPassenger } = seedPassenger();
        const { data: booking } = await asPassenger.post("booking/", RIDE);
        await waitFor(() => expect(socket.result.current.pending?.id).toBe(booking.id));
        expect(getPerson(socket.result.current.pending, true)).toMatchObject({ role: "passenger", name: "Maria Santos" });
        expect(backend.queue.has(driverId)).toBe(false); // an offer takes the driver out of the queue

        // ---- 6. accept (the "New Booking" card) ----
        await act(async () => socket.result.current.acceptBooking(booking.id));
        await waitFor(() => expect(socket.result.current.accepted?.status).toBe("accepted"));
        expect(socket.result.current.pending).toBeNull();
        expect(await driverQueueStatus()).toMatchObject({ en_route: true, booking_id: booking.id, booking_status: "accepted" });

        // ---- 7. drive to the pickup point and pick up (components/BottomDetails.jsx) ----
        expect(isNearPickup(booking, PLACES.nearPickup)).toBe(true);
        const picked = await inProgressBooking(booking.id, newIdempotencyKey(), PLACES.nearPickup);
        expect(picked.status).toBe("in_progress");
        await waitFor(() => expect(socket.result.current.accepted.status).toBe("in_progress"));

        // ---- 8. complete ----
        const completed = await completeBooking(booking.id, newIdempotencyKey());
        expect(completed.status).toBe("completed");
        await waitFor(() => expect(socket.result.current.accepted.status).toBe("completed"));
        expect(await driverQueueStatus()).toMatchObject({ en_route: false, ready: false });

        // ---- 9. rate the passenger (components/RateUser.jsx) ----
        await createRate({ booking_id: booking.id, user_id: passenger.id, score: 4, feedback: null });
        expect(backend.user("maria").rating).toBe(4);

        // ---- 10. earnings (profile) and history ----
        const earnings = await getDriverEarnings();
        expect(earnings.today).toEqual({ total: booking.price, trips: 1 });
        const history = await getBookingHistory();
        expect(history.map((b) => [b.id, b.status])).toEqual([[booking.id, "completed"]]);

        // ---- 11. back online for the next ride, then go offline ----
        await driverQueue(QUEUE_SPOT);
        await expect(driverDequeue()).resolves.toBeUndefined(); // 204, no body
        expect(await driverQueueStatus()).toMatchObject({ ready: false });

        // the passenger can rate the driver too
        expect((await asPassenger.post("booking/rate/", { booking_id: booking.id, user_id: driverId, score: 5 })).ok).toBe(true);
        expect(backend.user("pedro").rating).toBe(5);
    });

    it("a declined offer goes to the next driver", async () => {
        const ctx = await offered();
        const other = backend.seedUser({ username: "juan", role: "driver" });
        const asOther = as(backend, other.tokens);
        await asOther.post("booking/driver/queue", QUEUE_SPOT);
        const otherSocket = asOther.socket(`ws/driver/${other.user.id}`);
        await flush();

        await act(async () => ctx.socket.result.current.declineBooking(ctx.booking.id, PLACES.nearPickup));
        await waitFor(() => expect(ctx.socket.result.current.pending).toBeNull());
        await flush();
        expect(otherSocket.messages.find((m) => m.type === "new_booking")?.data.id).toBe(ctx.booking.id);
        expect(backend.queue.has(ctx.driverId)).toBe(true); // declining puts the driver back in the queue
    });

    it("a repeated pickup tap with the same idempotency key is answered once", async () => {
        const { booking } = await accepted();
        const key = newIdempotencyKey();
        const first = await inProgressBooking(booking.id, key, PLACES.nearPickup);
        const again = await inProgressBooking(booking.id, key, PLACES.nearPickup);
        expect(again).toEqual(first);
    });
});

describe("driver flow: errors", () => {
    describe("registration", () => {
        it("missing vehicle photos are reported by field", async () => {
            const { vehicle_back_picture, ...profile } = FORM.driver_profile;
            const res = await driverRegister({ ...FORM, driver_profile: profile });
            expect(res).toMatchObject({ success: false, kind: "validation", error: "No file was submitted." });
            expect(res.data.driver_profile.vehicle_back_picture).toEqual(["No file was submitted."]);
        });

        it("a taken username is refused", async () => {
            await driverRegister(FORM);
            expect((await driverRegister(FORM)).error).toBe("A user with that username already exists.");
        });

        it("a wrong OTP is refused; the driver stays unverified", async () => {
            const auth = await renderAuth();
            unmounts.push(auth.unmount);
            await registerAndLogin(auth, driverRegister, FORM);
            expect(await verifyDriverOtp({ otp: "999999" })).toEqual({ error: "Invalid OTP." });
            expect(backend.user("pedro").verified).toBe(false);
        });

        it("a passenger's OTP can't be checked on the driver endpoint", async () => {
            const auth = await renderAuth();
            unmounts.push(auth.unmount);
            const { tokens } = backend.seedUser({ username: "maria", role: "passenger", verified: false });
            await act(() => saveTokens(tokens, auth.result.current.setToken, auth.result.current.setUser));
            expect((await verifyDriverOtp({ otp: "123456" })).error).toBe("Driver profile not found.");
        });
    });

    describe("going online", () => {
        it("before TODA approval: the server's reason is shown", async () => {
            const auth = await renderAuth();
            unmounts.push(auth.unmount);
            await registerAndLogin(auth, driverRegister, FORM);
            await applyOtpResponse(auth, await verifyDriverOtp({ otp: "123456" }), saveTokens);
            await expect(driverQueue(QUEUE_SPOT)).rejects.toThrow("driver is awaiting TODA admin approval");
        });

        it("approved but not verified by OTP: refused", async () => {
            const auth = await renderAuth();
            unmounts.push(auth.unmount);
            await registerAndLogin(auth, driverRegister, FORM);
            backend.approveDriver("pedro");
            await expect(driverQueue(QUEUE_SPOT)).rejects.toThrow("driver is not verified");
        });

        it("a blacklisted driver can't go online", async () => {
            await readyDriver({ online: false });
            backend.user("pedro").status = "BLACKLISTED";
            await expect(driverQueue(QUEUE_SPOT)).rejects.toThrow("driver is blacklisted");
        });

        it("going online twice is refused", async () => {
            await readyDriver();
            await expect(driverQueue(QUEUE_SPOT)).rejects.toThrow("user already in queue");
        });

        it("going offline when not online is refused", async () => {
            await readyDriver({ online: false });
            await expect(driverDequeue()).rejects.toThrow("driver was not in queue");
        });

        it("no location yet: refused", async () => {
            await readyDriver({ online: false });
            await expect(driverQueue({ lat: null, lng: null })).rejects.toThrow("lat and lng are required");
        });

        it("no connection: the network message", async () => {
            await readyDriver({ online: false });
            backend.offlineNext();
            await expect(driverQueue(QUEUE_SPOT)).rejects.toThrow(ERROR_MESSAGES.network);
        });

        it("going offline right after an offer arrived fails (the offer took the driver out of the queue)", async () => {
            await offered();
            await expect(driverDequeue()).rejects.toThrow("driver was not in queue");
        });
    });

    describe("the offer", () => {
        it("an expired offer disappears from the screen", async () => {
            const { socket, booking } = await offered();
            await act(async () => backend.expireOffer(booking.id));
            await waitFor(() => expect(socket.result.current.pending).toBeNull());
        });

        it("accepting an expired offer: 'Booking unavailable', no ride", async () => {
            const { socket, booking } = await offered();
            await act(async () => backend.expireOffer(booking.id));
            await act(async () => socket.result.current.acceptBooking(booking.id));
            await waitFor(() =>
                expect(alert).toHaveBeenCalledWith("Booking unavailable", "This booking is no longer available.")
            );
            expect(socket.result.current.accepted).toBeNull();
        });

        it("a booking the passenger cancelled can't be accepted", async () => {
            const { socket, booking, asPassenger } = await offered();
            expect((await asPassenger.del(`booking/${booking.id}/`)).status).toBe(204);
            await act(async () => socket.result.current.acceptBooking(booking.id));
            await waitFor(() => expect(alert).toHaveBeenCalledWith("Booking unavailable", expect.any(String)));
            expect(socket.result.current.accepted).toBeNull();
        });
    });

    describe("the ride", () => {
        it("picking up far from the pickup point is refused with the distance", async () => {
            const { booking } = await accepted();
            expect(isNearPickup(booking, PLACES.farFromPickup)).toBe(false);
            await expect(inProgressBooking(booking.id, newIdempotencyKey(), PLACES.farFromPickup)).rejects.toThrow(
                /^You are \d+ m from the pickup point\. Get within 150 m to pick up the passenger\.$/
            );
            expect(backend.bookings[0].status).toBe("accepted");
        });

        it("picking up without a location is refused", async () => {
            const { booking } = await accepted();
            await expect(inProgressBooking(booking.id, newIdempotencyKey(), null)).rejects.toThrow(
                "Your location is not available yet. Please try again."
            );
        });

        it("completing before the pickup is refused", async () => {
            const { booking } = await accepted();
            await expect(completeBooking(booking.id, newIdempotencyKey())).rejects.toThrow(
                "Cannot transition booking from 'accepted' to 'completed'"
            );
        });

        it("completing twice is refused", async () => {
            const { booking } = await accepted();
            await inProgressBooking(booking.id, newIdempotencyKey(), PLACES.nearPickup);
            await completeBooking(booking.id, newIdempotencyKey());
            await expect(completeBooking(booking.id, newIdempotencyKey())).rejects.toThrow(
                "Cannot transition booking from 'completed' to 'completed'"
            );
        });

        it("another driver's ride can't be changed", async () => {
            const { booking } = await accepted();
            const other = backend.seedUser({ username: "juan", role: "driver" });
            const res = await as(backend, other.tokens).put(`booking/${booking.id}/`, { status: "in_progress", location: PLACES.nearPickup });
            expect(res).toMatchObject({ status: 404, data: { error: "Booking not found" } });
        });

        it("no connection on pickup: the network message, the ride is unchanged", async () => {
            const { booking } = await accepted();
            backend.offlineNext();
            await expect(inProgressBooking(booking.id, newIdempotencyKey(), PLACES.nearPickup)).rejects.toThrow(ERROR_MESSAGES.network);
            expect(backend.bookings[0].status).toBe("accepted");
        });
    });

    describe("rating", () => {
        async function finished() {
            const ctx = await accepted();
            await inProgressBooking(ctx.booking.id, newIdempotencyKey(), PLACES.nearPickup);
            await completeBooking(ctx.booking.id, newIdempotencyKey());
            return ctx;
        }

        it("rating a passenger who wasn't in the ride is refused", async () => {
            const { booking } = await finished();
            const { passenger: other } = seedPassenger("other");
            const err = await createRate({ booking_id: booking.id, user_id: other.id, score: 3 }).catch((e) => e);
            expect(err.message).toBe("user_id is not a participant in this booking");
            expect(err.data).toEqual({ user_id: ["user_id is not a participant in this booking"] });
        });

        it("rating twice is refused", async () => {
            const { booking, passenger } = await finished();
            await createRate({ booking_id: booking.id, user_id: passenger.id, score: 5 });
            await expect(createRate({ booking_id: booking.id, user_id: passenger.id, score: 1 })).rejects.toThrow(
                "You have already rated this booking"
            );
        });

        it("a driver who wasn't in the ride can't rate it", async () => {
            const { booking, passenger } = await finished();
            const other = backend.seedUser({ username: "juan", role: "driver" });
            const res = await as(backend, other.tokens).post("booking/rate/", { booking_id: booking.id, user_id: passenger.id, score: 1 });
            expect(res).toMatchObject({ status: 403, data: { detail: "You are not a participant in this booking" } });
        });

        it("a booking that doesn't exist is refused", async () => {
            const { passenger } = await finished();
            await expect(createRate({ booking_id: 9999, user_id: passenger.id, score: 5 })).rejects.toThrow("Booking not found");
        });
    });
});
