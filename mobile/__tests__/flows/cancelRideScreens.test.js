// The passenger cancels a ride before pickup, through the real screens (appHarness.js):
//   passenger: trip screen -> "Cancel Ride" -> confirm -> Home (driver's app told)
//   driver:    trip screen -> the passenger cancels -> "Ride cancelled" alert -> Home
// The other side of the ride acts straight on the fake backend (fakeBackend.js).
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { jwtDecode } from "jwt-decode";

import { createFakeBackend } from "./fakeBackend";
import { TestApp, press, routeOf, waitForScreen } from "./appHarness";
import { PLACES, as, flush, quietConsole } from "./helpers";
import { ERROR_MESSAGES } from "../../constants/errors";

jest.mock("expo-router", () => require("./screenMocks").expoRouter);
jest.mock("expo-location", () => require("./screenMocks").expoLocation);
jest.mock("expo-image-picker", () => require("./screenMocks").expoImagePicker);
jest.mock("expo-camera", () => require("./screenMocks").expoCamera);
jest.mock("../../background", () => require("./screenMocks").background);
jest.mock("../../components/map/MapComponent", () => require("./screenMocks").mapComponent);

const { navigation, background } = require("./screenMocks");

const RIDE = {
    start: PLACES.pickup,
    start_address: "Malolos Cathedral",
    end: PLACES.dropoff,
    end_address: "Robinsons Malolos",
    stops: [],
    routes: [PLACES.pickup, PLACES.dropoff],
    type: "regular",
};

let backend;
let restoreConsole;
let alert;

beforeEach(async () => {
    restoreConsole = quietConsole();
    alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await AsyncStorage.clear();
    SecureStore.__store.clear();
    backend = createFakeBackend();
});

afterEach(() => {
    alert.mockRestore();
    restoreConsole();
});

const route = () => routeOf(navigation.path);

// This phone is logged in as `tokens`' user (what login / OTP store)
async function signInAs(tokens) {
    await SecureStore.setItemAsync("token", JSON.stringify(tokens));
    await AsyncStorage.setItem("user", JSON.stringify(jwtDecode(tokens.access)));
}

// Tap a button in the last Alert.alert (e.g. "Cancel Ride" in "Cancel this ride?")
async function answerAlert(title, buttonText) {
    const call = [...alert.mock.calls].reverse().find(([t]) => t === title);
    if (!call) throw new Error(`No alert "${title}"; got: ${alert.mock.calls.map((c) => c[0]).join(", ")}`);
    const button = call[2].find((b) => b.text === buttonText);
    await act(async () => button.onPress?.());
}

function seedPair() {
    const passenger = backend.seedUser({
        username: "maria", role: "passenger", first_name: "maria", last_name: "santos",
        profile: { contact_number: "09171234567" },
    });
    const driver = backend.seedUser({
        username: "pedro", role: "driver", first_name: "pedro", last_name: "reyes",
        profile: { contact_number: "09181112222", toda_number: "07-123", vehicle_plate: "TRY 123" },
    });
    return { passenger, driver, asPassenger: as(backend, passenger.tokens), asDriver: as(backend, driver.tokens) };
}

// ---------------------------------------------------------------------------
// Passenger's phone
// ---------------------------------------------------------------------------
describe("passenger cancels before pickup", () => {
    // Passenger on the trip screen of a ride Pedro accepted
    async function onTrip() {
        const ctx = seedPair();
        await ctx.asDriver.post("booking/driver/queue", { lat: PLACES.pickup.lat, lng: PLACES.pickup.lng });
        const driverSocket = ctx.asDriver.socket(`ws/driver/${ctx.driver.user.id}`);
        await signInAs(ctx.passenger.tokens);
        navigation.reset("/(protected)/passenger/home");
        await render(<TestApp />);
        await waitForScreen("/passenger/home", "Book a Ride");
        await flush();

        await act(async () => void (await ctx.asPassenger.post("booking/", RIDE)));
        await flush();
        const booking = backend.bookings[0];
        await act(async () => driverSocket.send(JSON.stringify({ action: "accept_booking", booking_id: booking.id })));
        await waitForScreen("/passenger/en_route", "Pedro Reyes");
        return { ...ctx, booking, driverSocket };
    }

    it("Cancel Ride asks first, then cancels, tells the driver and goes Home", async () => {
        const { booking, driverSocket } = await onTrip();
        expect(screen.getByRole("button", { name: "Cancel Ride" })).toBeTruthy();

        await press("Cancel Ride");
        const [title, message, buttons] = alert.mock.calls.at(-1);
        expect(title).toBe("Cancel this ride?");
        expect(message).toMatch(/driver is on the way/);
        expect(buttons.map((b) => b.text)).toEqual(["Keep Ride", "Cancel Ride"]);

        await answerAlert("Cancel this ride?", "Cancel Ride");
        await waitForScreen("/passenger/home", "Book a Ride");
        expect(backend.bookings[0]).toMatchObject({ id: booking.id, status: "cancelled" });
        expect(driverSocket.messages.find((m) => m.type === "booking_update")?.data).toMatchObject({
            id: booking.id,
            status: "cancelled",
        });
        // no error alert, and the Booking tab is a new booking again
        expect(alert.mock.calls.map((c) => c[0])).not.toContain("Couldn't cancel the ride");
    });

    it("Keep Ride keeps the ride", async () => {
        const { booking } = await onTrip();
        await press("Cancel Ride");
        await answerAlert("Cancel this ride?", "Keep Ride");
        await act(async () => new Promise((r) => setTimeout(r, 30)));
        expect(route()).toBe("/passenger/en_route");
        expect(backend.bookings[0]).toMatchObject({ id: booking.id, status: "accepted" });
    });

    it("no Cancel Ride once the driver has picked the passenger up", async () => {
        const { booking, asDriver } = await onTrip();
        await act(async () => void (await asDriver.put(`booking/${booking.id}/`, { status: "in_progress", location: PLACES.nearPickup })));
        await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel Ride" })).toBeNull());
    });

    it("picked up a moment before the tap: the server's reason, still on the trip", async () => {
        const { booking } = await onTrip();
        backend.bookings[0].status = "in_progress"; // the update hasn't reached this phone yet
        await press("Cancel Ride");
        await answerAlert("Cancel this ride?", "Cancel Ride");
        await waitFor(() =>
            expect(alert).toHaveBeenCalledWith(
                "Couldn't cancel the ride",
                "Your driver has already picked you up, so the ride can't be cancelled."
            )
        );
        expect(route()).toBe("/passenger/en_route");
        expect(backend.bookings[0]).toMatchObject({ id: booking.id, status: "in_progress" });
    });

    it("no connection: says so, the ride isn't cancelled", async () => {
        const { booking } = await onTrip();
        await press("Cancel Ride");
        backend.offlineNext();
        await answerAlert("Cancel this ride?", "Cancel Ride");
        await waitFor(() => expect(alert).toHaveBeenCalledWith("Couldn't cancel the ride", ERROR_MESSAGES.network));
        expect(route()).toBe("/passenger/en_route");
        expect(backend.bookings[0]).toMatchObject({ id: booking.id, status: "accepted" });
        expect(screen.getByRole("button", { name: "Cancel Ride" })).toBeTruthy(); // can try again
    });
});

// ---------------------------------------------------------------------------
// Driver's phone
// ---------------------------------------------------------------------------
describe("driver's phone when the passenger cancels", () => {
    async function driverOnTrip() {
        const ctx = seedPair();
        await signInAs(ctx.driver.tokens);
        navigation.reset("/(protected)/driver/home");
        await render(<TestApp />);
        await waitForScreen("/driver/home", "Ready");
        await press("Ready");
        await screen.findByText("You're Online.");
        await act(async () => void (await ctx.asPassenger.post("booking/", RIDE)));
        await flush();
        await screen.findByText("Accept");
        await press("Accept");
        await waitForScreen("/driver/en_route", "Pick Up Passenger");
        return { ...ctx, booking: backend.bookings[0] };
    }

    it("shows 'Ride cancelled', stops sharing location and goes Home", async () => {
        const { booking, asPassenger } = await driverOnTrip();
        expect(screen.queryByRole("button", { name: "Cancel Ride" })).toBeNull();
        background.stopDriverLocationUpdates.mockClear();

        const res = await act(async () => asPassenger.post(`booking/${booking.id}/cancel/`));
        expect(res.data.status).toBe("cancelled");

        await waitForScreen("/driver/home", "Ready");
        expect(alert).toHaveBeenCalledWith(
            "Ride cancelled",
            "The passenger cancelled this ride. Tap Ready to get your next booking."
        );
        expect(background.stopDriverLocationUpdates).toHaveBeenCalled();
        expect(screen.queryByText("Pick Up Passenger")).toBeNull();
    });

    it("can go online and take the next booking", async () => {
        const { booking, asPassenger } = await driverOnTrip();
        await act(async () => asPassenger.post(`booking/${booking.id}/cancel/`));
        await waitForScreen("/driver/home", "Ready");
        await press("Ready");
        await screen.findByText("You're Online.");
        await act(async () => void (await asPassenger.post("booking/", RIDE)));
        await flush();
        await screen.findByText("Accept");
    });

    it("picking up after the passenger cancelled is refused", async () => {
        const { booking, asPassenger, asDriver } = await driverOnTrip();
        await act(async () => asPassenger.post(`booking/${booking.id}/cancel/`));
        const res = await asDriver.put(`booking/${booking.id}/`, { status: "in_progress", location: PLACES.nearPickup });
        expect(res.status).toBe(400);
        expect(res.data.error).toBe("Cannot transition booking from 'cancelled' to 'in_progress'");
    });
});

// ---------------------------------------------------------------------------
// API (api/book.js cancelRide) against the fake backend
// ---------------------------------------------------------------------------
describe("cancelRide()", () => {
    const { cancelRide } = require("../../api/book");

    it("pending: the booking is deleted", async () => {
        const { passenger, asPassenger } = seedPair();
        await signInAs(passenger.tokens);
        const { data: b } = await asPassenger.post("booking/", RIDE); // no driver online: stays pending
        await expect(cancelRide(b.id)).resolves.toEqual({ id: b.id, status: "cancelled" });
        expect(backend.bookings).toHaveLength(0);
    });

    it("someone else's booking: not found", async () => {
        const { asPassenger } = seedPair();
        const { data: b } = await asPassenger.post("booking/", RIDE);
        const other = backend.seedUser({ username: "juan", role: "passenger" });
        await signInAs(other.tokens);
        await expect(cancelRide(b.id)).rejects.toThrow("Booking not found");
    });

    it("an ended ride: refused", async () => {
        const { passenger } = seedPair();
        await signInAs(passenger.tokens);
        backend.bookings.push({ id: 900, status: "completed", passengerId: passenger.user.id, driverId: null, declinedBy: [] });
        await expect(cancelRide(900)).rejects.toThrow("This ride has already ended.");
    });
});
