// Driver flow through the real screens: Landing → Choose a role → Sign up (account, then profile with
// TODA station + 4 photos) → OTP → Home ("Ready") → New Booking popup → Accept → trip screen (pickup
// locked until within 150 m) → Pick Up Passenger → Complete Ride → receipt → Rate Passenger → Home.
// Every step checks what the screen shows; the screens' own router calls move the flow on
// (appHarness.js). A seeded passenger on the fake backend (fakeBackend.js) books the ride.
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { createFakeBackend } from "./fakeBackend";
import { TestApp, choosePhoto, fill, press, routeOf, waitForScreen } from "./appHarness";
import { PLACES, as, flush, quietConsole } from "./helpers";
import { ERROR_MESSAGES } from "../../constants/errors";

jest.mock("expo-router", () => require("./screenMocks").expoRouter);
jest.mock("expo-location", () => require("./screenMocks").expoLocation);
jest.mock("expo-image-picker", () => require("./screenMocks").expoImagePicker);
jest.mock("expo-camera", () => require("./screenMocks").expoCamera);
jest.mock("../../background", () => require("./screenMocks").background);
jest.mock("../../components/map/MapComponent", () => require("./screenMocks").mapComponent);

const { navigation, expoLocation } = require("./screenMocks");

const RIDE = {
    start: PLACES.pickup,
    start_address: "Malolos Cathedral",
    end: PLACES.dropoff,
    end_address: "Robinsons Malolos",
    stops: [],
    routes: [PLACES.pickup, PLACES.dropoff],
    type: "regular",
};
const PHOTOS = ["License ID", "Profile Picture", "Vehicle Front", "Vehicle Back"];

let backend;
let restoreConsole;
let alert;

beforeEach(async () => {
    restoreConsole = quietConsole();
    alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await AsyncStorage.clear();
    SecureStore.__store.clear();
    backend = createFakeBackend();
    navigation.reset("/");
    expoLocation.setPosition({ latitude: PLACES.pickup.lat, longitude: PLACES.pickup.lng });
});

afterEach(() => {
    alert.mockRestore();
    restoreConsole();
});

const settle = (ms = 30) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const route = () => routeOf(navigation.path);

// ---- steps, each checking its screen ----

async function openSignUp() {
    await render(<TestApp />);
    await press("Register");
    await waitForScreen("/choose_a_role", "Register as Driver");
    await press("Register as Driver");
    await waitForScreen("/register/driver", "Sign Up As A Driver");
    await fill({ "First Name": "Pedro", "Last Name": "Reyes", Username: "pedro", Password: "Pedro#2026", "Confirm Password": "Pedro#2026" });
    await press("Next");
    await screen.findByText("Toda Number");
}

// The profile step; `skip` leaves those parts out
async function fillProfile({ skip = [], toda = "07-123" } = {}) {
    await fill({ Address: "Malolos, Bulacan", "Contact Number": "09181112222", "Toda Number": toda });
    if (!skip.includes("station")) {
        // the TODA number's first two digits load that TODA's stations
        await screen.findByText("Malolos Crossing", {}, { timeout: 2000 });
        await press("Malolos Crossing");
    }
    await fill({ "Franchise Permit Number": "FP-0001", "License Number": "N01-23-456789", "Vehicle Plate": "TRY 123" });
    for (const label of PHOTOS) if (!skip.includes(label)) await choosePhoto(label);
}

// Sign up through both steps; ends on the OTP screen
async function signUp() {
    await openSignUp();
    await fillProfile();
    await press("Register");
    await waitForScreen("/otp", "Enter your code");
}

async function enterOtp(code) {
    await fireEvent.changeText(screen.root.queryAll((n) => n.type === "TextInput")[0], code);
    await settle();
}

// Signed up, verified and approved; ends on the driver home screen
async function readyToWork() {
    await signUp();
    await enterOtp("123456");
    await waitForScreen("/driver/home", "Ready");
    backend.approveDriver("pedro");
}

function passenger() {
    const { user, tokens } = backend.seedUser({
        username: "maria",
        role: "passenger",
        first_name: "maria",
        last_name: "santos",
        profile: { contact_number: "09171234567" },
    });
    return { passenger: user, asPassenger: as(backend, tokens) };
}

// Online and offered Maria's ride; ends with the New Booking popup on screen
async function offered() {
    await readyToWork();
    await press("Ready");
    await screen.findByText("You're Online.");
    const p = passenger();
    await act(async () => void (await p.asPassenger.post("booking/", RIDE)));
    await flush();
    await screen.findByText("Accept");
    return { ...p, booking: backend.bookings[0] };
}

// Accepted; ends on the trip screen
async function onTrip() {
    const ctx = await offered();
    await press("Accept");
    await waitForScreen("/driver/en_route", "Pick Up Passenger");
    return ctx;
}

const moveTo = (bookingId, coords) => act(async () => backend.driverMoved(bookingId, coords));

describe("driver screens: happy path", () => {
    it("signs up, goes online, takes the ride, completes it and rates the passenger", async () => {
        // ---- sign up: account step, then profile with a TODA station and the photos ----
        await openSignUp();
        await fillProfile();
        expect(screen.queryAllByText("Click to Upload")).toHaveLength(0); // all 4 photos picked
        await press("Register");
        await waitForScreen("/otp", "Enter your code");
        const signup = backend.requests.find((r) => r.path === "driver/");
        expect(signup.body).toMatchObject({
            username: "pedro",
            first_name: "Pedro",
            last_name: "Reyes",
            __multipart: true,
            driver_profile: { toda_number: "07-123", toda_station: "71", vehicle_plate: "TRY 123" },
        });

        // ---- OTP ----
        await enterOtp("123456");
        await waitForScreen("/driver/home", "Ready");
        expect(screen.getByText(/To Accept Booking From Passengers You Must be/)).toBeTruthy();
        backend.approveDriver("pedro"); // TODA admin, in the dashboard

        // ---- Ready: online, waiting for a booking ----
        await press("Ready");
        await screen.findByText("You're Online.");
        expect(backend.queue.has(backend.user("pedro").id)).toBe(true);

        // ---- a passenger books: the New Booking popup ----
        const { passenger: maria, asPassenger } = passenger();
        await act(async () => void (await asPassenger.post("booking/", RIDE)));
        await flush();
        await screen.findByText("Accept");
        expect(screen.getByText("Maria Santos")).toBeTruthy();
        expect(screen.getByText("Decline")).toBeTruthy();
        expect(screen.getByText("Pickup:")).toBeTruthy();
        expect(screen.getAllByText("Malolos Cathedral").length).toBeGreaterThan(0);
        const booking = backend.bookings[0];

        // ---- Accept: the trip screen ----
        await press("Accept");
        await waitForScreen("/driver/en_route", "Pick Up Passenger");
        expect(screen.getByText("Passenger:")).toBeTruthy();
        expect(screen.getByText("Maria Santos")).toBeTruthy();
        expect(backend.bookings[0]).toMatchObject({ status: "accepted", driverId: backend.user("pedro").id });

        // ---- pickup is locked until the driver is near ----
        await moveTo(booking.id, PLACES.farFromPickup);
        await screen.findByText(/^You are \d+ m away\. Get within 150 m of the pickup point/);
        await press("Pick Up Passenger");
        expect(backend.bookings[0].status).toBe("accepted"); // locked: nothing sent

        await moveTo(booking.id, PLACES.nearPickup);
        expect(screen.queryByText(/m away\. Get within/)).toBeNull();
        await press("Pick Up Passenger");
        await screen.findByText("Complete Ride");
        expect(backend.bookings[0].status).toBe("in_progress");

        // ---- complete: the receipt ----
        await press("Complete Ride");
        await waitForScreen("/driver/complete", "Excellent Work!");
        expect(screen.getByText("Fare Earned:")).toBeTruthy();
        expect(screen.getByText(`₱ ${booking.price}`)).toBeTruthy();
        expect(screen.getByText("Robinsons Malolos")).toBeTruthy();

        // ---- rate the passenger, back home ----
        await press("Rate Passenger");
        await screen.findByText("Maria Santos");
        await fireEvent.press(screen.getByLabelText("4 stars"));
        await press("Submit");
        await waitForScreen("/driver/home", "Ready");
        expect(backend.ratings).toEqual([expect.objectContaining({ bookingId: booking.id, userId: maria.id, score: 4 })]);
    });

    it("declining closes the popup and the driver can get the next one", async () => {
        await offered();
        await press("Decline");
        await settle();
        expect(screen.queryByText("Accept")).toBeNull();
        expect(route()).toBe("/driver/home");
        expect(backend.queue.has(backend.user("pedro").id)).toBe(true);
    });

    it("Go Offline asks first, then leaves the queue", async () => {
        await readyToWork();
        await press("Ready");
        await screen.findByText("You're Online.");
        await press("Go Offline");
        const [title, , buttons] = alert.mock.calls.at(-1);
        expect(title).toBe("Go offline?");
        await act(async () => buttons.find((b) => b.text === "Go Offline").onPress());
        await screen.findByText(/To Accept Booking From Passengers You Must be/);
        expect(backend.queue.size).toBe(0);
    });
});

describe("driver screens: errors", () => {
    describe("sign up", () => {
        it("missing photos and station are flagged before anything is sent", async () => {
            await openSignUp();
            await fillProfile({ skip: ["station", "Profile Picture", "Vehicle Back"] });
            await press("Register");
            expect(screen.getByText("Please select a TODA station")).toBeTruthy();
            expect(screen.getByText("Profile picture is required")).toBeTruthy();
            expect(screen.getByText("Vehicle back image is required")).toBeTruthy();
            expect(backend.requests.some((r) => r.path === "driver/")).toBe(false);
        });

        it("a TODA number in the wrong format", async () => {
            await openSignUp();
            await fill({ "Toda Number": "7123" });
            await press("Register");
            expect(screen.getByText("Format must be 01-XXX to 11-XXX (e.g., 01-123 or 10-400)")).toBeTruthy();
        });

        it("a plate in the wrong format", async () => {
            await openSignUp();
            await fill({ "Vehicle Plate": "1234" });
            await press("Register");
            expect(screen.getByText("Invalid plate format (e.g., ABC1234)")).toBeTruthy();
        });

        it("a taken username: the server refuses and the screen stays on the form", async () => {
            backend.seedUser({ username: "pedro", role: "driver" });
            await openSignUp();
            await fillProfile();
            await press("Register");
            await settle();
            expect(route()).toBe("/register/driver");
            expect(backend.users).toHaveLength(1);
        });

        it("a wrong OTP shows the server's message", async () => {
            await signUp();
            await enterOtp("999999");
            await screen.findByText("Invalid OTP.");
            expect(route()).toBe("/otp");
        });
    });

    describe("going online", () => {
        it("before TODA approval: the server's reason is shown on Home", async () => {
            await signUp();
            await enterOtp("123456");
            await waitForScreen("/driver/home", "Ready");
            await press("Ready");
            await screen.findByText("driver is awaiting TODA admin approval");
            expect(backend.queue.size).toBe(0);
        });

        it("location permission denied: the message is shown, nothing sent", async () => {
            await readyToWork();
            expoLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
            await press("Ready");
            await screen.findByText("Permission to access location was denied");
            expect(backend.queue.size).toBe(0);
        });

        it("no connection: the network message", async () => {
            await readyToWork();
            backend.offlineNext();
            await press("Ready");
            await screen.findByText(ERROR_MESSAGES.network);
        });
    });

    describe("the offer", () => {
        it("an offer that expires closes the popup", async () => {
            const { booking } = await offered();
            await act(async () => backend.expireOffer(booking.id));
            await settle();
            expect(screen.queryByText("Accept")).toBeNull();
        });

        it("accepting a ride the passenger just cancelled: 'Booking unavailable', no trip", async () => {
            const { booking, asPassenger } = await offered();
            await act(async () => void (await asPassenger.del(`booking/${booking.id}/`)));
            await press("Accept");
            await settle();
            expect(alert).toHaveBeenCalledWith("Booking unavailable", "This booking is no longer available.");
            expect(route()).toBe("/driver/home");
        });
    });

    describe("the trip", () => {
        it("no location yet: pickup stays locked", async () => {
            await onTrip();
            expect(screen.getByText("Getting your location...")).toBeTruthy();
            await press("Pick Up Passenger");
            expect(backend.bookings[0].status).toBe("accepted");
        });

        it("no connection on pickup: 'Can't pick up yet' with the network message", async () => {
            const { booking } = await onTrip();
            await moveTo(booking.id, PLACES.nearPickup);
            backend.offlineNext();
            await press("Pick Up Passenger");
            await settle();
            expect(alert).toHaveBeenCalledWith("Can't pick up yet", ERROR_MESSAGES.network);
            expect(screen.getByText("Pick Up Passenger")).toBeTruthy();
        });

        it("no connection on completing: 'Couldn't complete the ride', still on the trip", async () => {
            const { booking } = await onTrip();
            await moveTo(booking.id, PLACES.nearPickup);
            await press("Pick Up Passenger");
            await screen.findByText("Complete Ride");
            backend.offlineNext();
            await press("Complete Ride");
            await settle();
            expect(alert).toHaveBeenCalledWith("Couldn't complete the ride", ERROR_MESSAGES.network);
            expect(route()).toBe("/driver/en_route");
        });
    });

    describe("rating", () => {
        it("Submit without stars asks for a score", async () => {
            const { booking } = await onTrip();
            await moveTo(booking.id, PLACES.nearPickup);
            await press("Pick Up Passenger");
            await screen.findByText("Complete Ride");
        await press("Complete Ride");
            await waitForScreen("/driver/complete", "Rate Passenger");
            await press("Rate Passenger");
            await screen.findByText("Submit");
        await press("Submit");
            expect(screen.getByText("Tap a star to rate from 1 to 5.")).toBeTruthy();
            expect(backend.ratings).toHaveLength(0);
        });
    });
});
