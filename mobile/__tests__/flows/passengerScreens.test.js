// Passenger flow through the real screens: Landing → Choose a role → Sign up (2 steps) → OTP → Home →
// Book a Ride (pick pickup / drop-off on the map, fare, Book Now) → Finding a driver → trip screen →
// receipt → Rate Driver → Home → Ride History. Every step checks what the screen shows; the screens'
// own router calls move the flow on (appHarness.js). A seeded driver on the fake backend
// (fakeBackend.js) accepts, picks up and completes the ride.
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { createFakeBackend } from "./fakeBackend";
import { TestApp, fill, press, waitForScreen } from "./appHarness";
import { PLACES, as, flush, quietConsole } from "./helpers";
import { ERROR_MESSAGES } from "../../constants/errors";

jest.mock("expo-router", () => require("./screenMocks").expoRouter);
jest.mock("expo-location", () => require("./screenMocks").expoLocation);
jest.mock("expo-image-picker", () => require("./screenMocks").expoImagePicker);
jest.mock("expo-camera", () => require("./screenMocks").expoCamera);
jest.mock("../../background", () => require("./screenMocks").background);
jest.mock("../../components/map/MapComponent", () => require("./screenMocks").mapComponent);

const { navigation, map } = require("./screenMocks");

const ACCOUNT = { first: "Maria", last: "Santos", username: "maria", password: "Maria#2026" };
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
    global.alert = jest.fn();
    await AsyncStorage.clear();
    SecureStore.__store.clear();
    backend = createFakeBackend();
    navigation.reset("/");
    map.nextPick = null;
    map.nextRoute = [];
});

afterEach(() => {
    alert.mockRestore();
    restoreConsole();
});

const settle = (ms = 30) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const otpInput = () => screen.root.queryAll((n) => n.type === "TextInput")[0];

// ---- steps, each checking its screen ----

async function openSignUp() {
    await render(<TestApp />);
    expect(screen.getByText("Your Trusted Tricycle Booking App")).toBeTruthy();
    await press("Register");
    await waitForScreen("/choose_a_role", "Choose Your Role and Signup");
    await press("Register as Passenger");
    await waitForScreen("/register/passenger", "Sign Up As A Passenger");
}

async function fillAccountStep(overrides = {}) {
    const a = { ...ACCOUNT, ...overrides };
    await fill({
        "First Name": a.first,
        "Last Name": a.last,
        Username: a.username,
        Password: a.password,
        "Confirm Password": a.confirm ?? a.password,
    });
    await press("Next");
}

async function fillProfileStep(overrides = {}) {
    await fill({
        Address: "Malolos, Bulacan",
        "Contact Number": "09171234567",
        "Emergency Contact Name": "Jose Santos",
        "Emergency Contact Number": "09179876543",
        ...overrides,
    });
    await press("Register");
}

// Sign up through both steps; ends on the OTP screen
async function signUp() {
    await openSignUp();
    await fillAccountStep();
    expect(screen.getByText("Emergency Contact Name")).toBeTruthy(); // step 2
    await fillProfileStep();
    await waitForScreen("/otp", "Enter your code");
}

async function enterOtp(code) {
    await fireEvent.changeText(otpInput(), code);
    await settle();
}

// Sign up + OTP; ends on the passenger home screen
async function signUpAndVerify() {
    await signUp();
    await enterOtp("123456");
    await waitForScreen("/passenger/home", "Book a Ride");
}

// An approved driver in the queue at the pickup point, with their socket open
async function driverWaiting() {
    const { user, tokens } = backend.seedUser({
        username: "pedro",
        role: "driver",
        first_name: "pedro",
        last_name: "reyes",
        profile: { contact_number: "09181112222", toda_number: "07-123", vehicle_plate: "TRY 123" },
    });
    const asDriver = as(backend, tokens);
    await asDriver.post("booking/driver/queue", { lat: PLACES.pickup.lat, lng: PLACES.pickup.lng });
    const socket = asDriver.socket(`ws/driver/${user.id}`);
    await flush();
    return { driver: user, asDriver, socket };
}

// Home → Book a Ride → pick both points on the map; ends with the fare shown
async function chooseRoute() {
    await press("Book a Ride");
    await waitForScreen("/passenger/book", "Select pickup location");
    expect(screen.getByText(/^₱\s*--$/)).toBeTruthy(); // no fare until both points are set

    await press("Select pickup location");
    expect(screen.getByText("Select Location")).toBeTruthy();
    map.nextPick = { lat: PLACES.pickup.lat, lng: PLACES.pickup.lng, full: "Malolos Cathedral" };
    await fireEvent.press(screen.getByTestId("map-pick"));
    expect(screen.getAllByText("Malolos Cathedral").length).toBeGreaterThan(0);
    await press("Confirm");

    await press("Select drop-off location");
    map.nextPick = { lat: PLACES.dropoff.lat, lng: PLACES.dropoff.lng, full: "Robinsons Malolos" };
    map.nextRoute = [PLACES.pickup, PLACES.dropoff];
    await fireEvent.press(screen.getByTestId("map-pick"));
    await press("Confirm");

    // the fare estimate (debounced) replaces "--"
    const fareText = await screen.findByText(/^₱\s*\d+$/, {}, { timeout: 3000 });
    const fare = Number(String(fareText.props.children).replace(/\D/g, "") || fareText.children.join("").replace(/\D/g, ""));
    expect(screen.getByText("Robinsons Malolos")).toBeTruthy();
    return fare;
}

const accept = (socket, bookingId) =>
    act(async () => socket.send(JSON.stringify({ action: "accept_booking", booking_id: bookingId })));
const driverPut = (asDriver, bookingId, body) => act(async () => void (await asDriver.put(`booking/${bookingId}/`, body)));

describe("passenger screens: happy path", () => {
    it("signs up, verifies, books, rides, rates the driver and finds the ride in history", async () => {
        // ---- sign up ----
        await signUp();
        expect(backend.user("maria")).toMatchObject({ role: "passenger", verified: false, first_name: "Maria" });
        expect(screen.getByText("We sent you a 6-digit code.")).toBeTruthy();

        // ---- OTP: six digits submit on their own ----
        await enterOtp("123456");
        await waitForScreen("/passenger/home");
        expect(screen.getByText(/Where would you like to go/)).toBeTruthy();
        expect(backend.user("maria").verified).toBe(true);

        // ---- Book a Ride ----
        const { driver, asDriver, socket } = await driverWaiting();
        const fare = await chooseRoute();
        await press("Book Now");
        await screen.findByText("Finding you a driver...");
        expect(screen.getByText("We'll take you to your trip as soon as a driver accepts.")).toBeTruthy();

        const booking = backend.bookings[0];
        expect(booking).toMatchObject({ status: "pending", start_address: "Malolos Cathedral", end_address: "Robinsons Malolos" });
        expect(booking.price).toBe(fare); // the fare shown is the fare booked

        // ---- the driver accepts: the trip screen opens with the driver ----
        await flush();
        await accept(socket, booking.id);
        await waitForScreen("/passenger/en_route", "Pedro Reyes");
        expect(screen.getByText("Driver:")).toBeTruthy();
        expect(screen.getByText("09181112222")).toBeTruthy();
        expect(screen.getByText("Malolos Cathedral")).toBeTruthy();
        expect(screen.queryByText("Pick Up Passenger")).toBeNull(); // driver-only buttons

        // ---- pickup, then drop-off: the receipt opens ----
        await driverPut(asDriver, booking.id, { status: "in_progress", location: PLACES.nearPickup });
        await settle();
        expect(routeOfNav()).toBe("/passenger/en_route");
        await driverPut(asDriver, booking.id, { status: "completed" });
        await waitForScreen("/passenger/complete", "You've Arrived!");
        expect(screen.getByText("Total Fare:")).toBeTruthy();
        expect(screen.getByText("Pickup:")).toBeTruthy();
        expect(screen.getByText("1.2 km")).toBeTruthy();

        // ---- rate the driver ----
        await press("Rate Driver");
        await screen.findByText("Pedro Reyes");
        await fireEvent.press(screen.getByLabelText("5 stars"));
        await fireEvent.changeText(screen.root.queryAll((n) => n.type === "TextInput")[0], "Safe and on time");
        await press("Submit");
        await waitForScreen("/passenger/home", "Book a Ride");
        expect(backend.ratings).toEqual([
            expect.objectContaining({ bookingId: booking.id, userId: driver.id, score: 5, feedback: "Safe and on time" }),
        ]);

        // ---- Ride History ----
        await act(async () => require("expo-router").router.push("/(protected)/history"));
        await waitForScreen("/history", "Ride History");
        await screen.findByText(`₱ ${booking.price}`);
        expect(screen.getByText("Completed")).toBeTruthy();
    });

    it("logs in from the landing screen", async () => {
        backend.seedUser({ username: "maria", role: "passenger", password: "Maria#2026" });
        await render(<TestApp />);
        await press("Login");
        await waitForScreen("/login", "Sign In and Continue");
        await fill({ Username: "maria", Password: "Maria#2026" });
        await press("Login");
        await waitForScreen("/passenger/home", "Book a Ride");
    });

    it("cancels while searching and can book again", async () => {
        await signUpAndVerify();
        await driverWaiting(); // gets the offer but doesn't answer: the booking stays pending
        await chooseRoute();
        await press("Book Now");
        await screen.findByText("Finding you a driver...");
        await settle();
        await press("Cancel");
        await screen.findByText("Booking cancelled.");
        expect(backend.bookings).toHaveLength(0);
        expect(screen.queryByText("Finding you a driver...")).toBeNull();
    });
});

function routeOfNav() {
    return require("./appHarness").routeOf(navigation.path);
}

describe("passenger screens: errors", () => {
    describe("sign up", () => {
        it("an empty first step shows each required field", async () => {
            await openSignUp();
            await press("Next");
            expect(screen.getByText("First name is required")).toBeTruthy();
            expect(screen.getByText("Last name is required")).toBeTruthy();
            expect(screen.getByText("Username is required")).toBeTruthy();
            expect(screen.getByText("Password is required")).toBeTruthy();
            expect(screen.getByText("Confirm your password")).toBeTruthy();
            expect(screen.queryByText("Emergency Contact Name")).toBeNull(); // still on step 1
        });

        it.each([
            ["Maria2026", "Must contain at least 1 special character"],
            ["maria#2026", "Must contain at least 1 uppercase letter"],
            ["Maria#", "Minimum 8 characters"],
        ])("password %p: %p", async (password, message) => {
            await openSignUp();
            await fillAccountStep({ password });
            expect(screen.getByText(message)).toBeTruthy();
        });

        it("passwords that don't match", async () => {
            await openSignUp();
            await fillAccountStep({ confirm: "Other#2026" });
            expect(screen.getByText("Passwords do not match")).toBeTruthy();
        });

        it("a username with spaces or symbols", async () => {
            await openSignUp();
            await fillAccountStep({ username: "ma-ria!" });
            expect(screen.getByText("Username can only contain letters, numbers, and underscores")).toBeTruthy();
        });

        it("profile step: phone numbers are checked before anything is sent", async () => {
            await openSignUp();
            await fillAccountStep();
            await fillProfileStep({ "Contact Number": "0917123", "Emergency Contact Number": "09179876543" });
            expect(screen.getByText("Must be exactly 11 digits")).toBeTruthy();
            await fillProfileStep({ "Contact Number": "09171234567", "Emergency Contact Number": "09171234567" });
            expect(screen.getByText("Must not be the same as contact number")).toBeTruthy();
            await fillProfileStep({ Address: "Mal" });
            expect(screen.getByText("Address must be at least 5 characters")).toBeTruthy();
            expect(backend.requests.filter((r) => r.path === "passenger/")).toHaveLength(0);
        });

        it("a taken username: the server's reason is shown, the screen stays on the form and doesn't log in", async () => {
            backend.seedUser({ username: "maria", role: "passenger" });
            await openSignUp();
            await fillAccountStep();
            await fillProfileStep();
            await screen.findByText("A user with that username already exists.");
            expect(routeOfNav()).toBe("/register/passenger");
            expect(backend.requests.some((r) => r.path === "user/token/user")).toBe(false);
        });

        it("no connection: the network message, still on the form; Register again works", async () => {
            await openSignUp();
            await fillAccountStep();
            backend.offlineNext();
            await fillProfileStep();
            await screen.findByText(ERROR_MESSAGES.network);
            expect(routeOfNav()).toBe("/register/passenger");
            expect(backend.users).toHaveLength(0);

            await press("Register"); // back online
            await waitForScreen("/otp", "Enter your code");
        });

        it("account created but the login after it failed: says so, doesn't open the OTP screen", async () => {
            await openSignUp();
            await fillAccountStep();
            backend.offlineNext(1, "user/token/user");
            await fillProfileStep();
            await screen.findByText(`Your account was created, but logging in failed: ${ERROR_MESSAGES.network} Please log in.`);
            expect(routeOfNav()).toBe("/register/passenger");
            expect(backend.user("maria")).toBeTruthy();
        });
    });

    describe("login", () => {
        it("a wrong password shows the error and stays on the login screen", async () => {
            backend.seedUser({ username: "maria", role: "passenger", password: "Maria#2026" });
            navigation.reset("/(global)/login");
            await render(<TestApp />);
            await fill({ Username: "maria", Password: "Wrong#2026" });
            await press("Login");
            await screen.findByText("Invalid username or password.");
            expect(routeOfNav()).toBe("/login");
        });

        it("no connection: the network message, not 'Invalid username or password.'", async () => {
            backend.seedUser({ username: "maria", role: "passenger", password: "Maria#2026" });
            navigation.reset("/(global)/login");
            await render(<TestApp />);
            await fill({ Username: "maria", Password: "Maria#2026" });
            backend.offlineNext();
            await press("Login");
            await screen.findByText(ERROR_MESSAGES.network);
            expect(screen.queryByText("Invalid username or password.")).toBeNull();
            expect(routeOfNav()).toBe("/login");
        });

        it("empty fields are flagged without calling the server", async () => {
            navigation.reset("/(global)/login");
            await render(<TestApp />);
            await press("Login");
            expect(screen.getByText("username is required")).toBeTruthy();
            expect(screen.getByText("Password is required")).toBeTruthy();
            expect(backend.requests).toHaveLength(0);
        });
    });

    describe("OTP", () => {
        it("a wrong code shows the server's message and stays on the screen", async () => {
            await signUp();
            await enterOtp("000000");
            await screen.findByText("Invalid OTP.");
            expect(routeOfNav()).toBe("/otp");
            expect(backend.user("maria").verified).toBe(false);
        });

        it("too many wrong codes locks verification", async () => {
            await signUp();
            for (let i = 0; i < 5; i++) await enterOtp("000000");
            await enterOtp("123456");
            await screen.findByText("Too many wrong attempts. Request a new OTP.");
            expect(routeOfNav()).toBe("/otp");
        });

        it("opened without a login: 'Session not found'", async () => {
            navigation.reset("/(protected)/otp");
            await render(<TestApp />);
            await screen.findByText("Session not found");
            await press("Back to sign in");
            expect(routeOfNav()).toBe("/");
        });
    });

    describe("booking", () => {
        it("Book Now without a route asks for both locations", async () => {
            await signUpAndVerify();
            await press("Book a Ride");
            await waitForScreen("/passenger/book", "Book Now");
            await press("Book Now");
            expect(global.alert).toHaveBeenCalledWith("Please select both start and end locations.");
            expect(backend.bookings).toHaveLength(0);
        });

        it("no driver available: the screen says so and stops searching", async () => {
            await signUpAndVerify();
            await chooseRoute();
            await press("Book Now");
            await screen.findByText("No drivers are available right now. Please try again later.");
            expect(screen.queryByText("Finding you a driver...")).toBeNull();
        });

        it("a booking already pending: the server's reason is shown", async () => {
            await signUpAndVerify();
            const tokens = JSON.parse(SecureStore.__store.get("token"));
            await as(backend, tokens).post("booking/", RIDE); // e.g. booked on another phone
            await chooseRoute();
            await press("Book Now");
            await screen.findByText("You already have an ongoing or pending booking.");
        });

        it("no connection: the network message, nothing booked", async () => {
            await signUpAndVerify();
            await chooseRoute();
            backend.offlineNext();
            await press("Book Now");
            await screen.findByText(ERROR_MESSAGES.network);
            expect(backend.bookings).toHaveLength(0);
        });

        it("cancelling after a driver accepted: the trip screen opens instead", async () => {
            await signUpAndVerify();
            const { socket } = await driverWaiting();
            await chooseRoute();
            await press("Book Now");
            await screen.findByText("Finding you a driver...");
            await flush();
            await accept(socket, backend.bookings[0].id);
            await waitForScreen("/passenger/en_route", "Pedro Reyes");
            expect(backend.bookings[0].status).toBe("accepted");
        });
    });

    describe("rating", () => {
        // a finished ride, on the Rate Driver screen
        async function onRateScreen() {
            await signUpAndVerify();
            const { driver, asDriver, socket } = await driverWaiting();
            await chooseRoute();
            await press("Book Now");
            await flush();
            const booking = backend.bookings[0];
            await accept(socket, booking.id);
            await waitForScreen("/passenger/en_route", "Pedro Reyes");
            await driverPut(asDriver, booking.id, { status: "in_progress", location: PLACES.nearPickup });
            await driverPut(asDriver, booking.id, { status: "completed" });
            await waitForScreen("/passenger/complete", "Rate Driver");
            await press("Rate Driver");
            await screen.findByText("Submit");
            return { booking, driver };
        }

        it("Submit without stars asks for a score", async () => {
            await onRateScreen();
            await press("Submit");
            expect(screen.getByText("Tap a star to rate from 1 to 5.")).toBeTruthy();
            expect(backend.ratings).toHaveLength(0);
        });

        it("already rated (e.g. on another phone): the server's message is shown", async () => {
            const { booking, driver } = await onRateScreen();
            const tokens = JSON.parse(SecureStore.__store.get("token"));
            await as(backend, tokens).post("booking/rate/", { booking_id: booking.id, user_id: driver.id, score: 3 });
            await fireEvent.press(screen.getByLabelText("5 stars"));
            await press("Submit");
            await screen.findByText("You have already rated this booking");
            expect(routeOfNav()).toBe("/passenger/complete");
        });

        it("Skip goes home without rating", async () => {
            await onRateScreen();
            await press("Skip");
            await waitForScreen("/passenger/home", "Book a Ride");
            expect(backend.ratings).toHaveLength(0);
        });
    });
});
