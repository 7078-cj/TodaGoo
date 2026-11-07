// Forgot password by SMS code, through the real screens: Login -> "Forgot password?" -> mobile number
// -> 6-digit code -> new password -> Login ("Password updated") -> log in with the new password.
// The fake backend (fakeBackend.js) answers like user/sms-reset/* and "sends" codes to
// backend.smsOutbox, so no SMS leaves the test. Countdown and expiry tests use jest fake timers.
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createFakeBackend } from "./fakeBackend";
import { TestApp, fill, press, routeOf, waitForScreen } from "./appHarness";
import { quietConsole } from "./helpers";
import { ERROR_MESSAGES } from "../../constants/errors";

jest.mock("expo-router", () => require("./screenMocks").expoRouter);
jest.mock("expo-location", () => require("./screenMocks").expoLocation);
jest.mock("expo-image-picker", () => require("./screenMocks").expoImagePicker);
jest.mock("expo-camera", () => require("./screenMocks").expoCamera);
jest.mock("../../background", () => require("./screenMocks").background);
jest.mock("../../components/map/MapComponent", () => require("./screenMocks").mapComponent);

const { navigation } = require("./screenMocks");

const PHONE = "09171234567";
const NEW_PASSWORD = "N3w-Secret!pass";

let backend;
let restoreConsole;
let user;

beforeEach(async () => {
    restoreConsole = quietConsole();
    await AsyncStorage.clear();
    SecureStore.__store.clear();
    backend = createFakeBackend();
    ({ user } = backend.seedUser({ username: "maria", role: "passenger", profile: { contact_number: PHONE } }));
    navigation.reset("/(global)/login");
});

afterEach(() => {
    jest.useRealTimers();
    restoreConsole();
});

const route = () => routeOf(navigation.path);
const button = (name) => screen.getByRole("button", { name });
const tap = (name) => fireEvent.press(button(name));
const isBusy = (name) => !!button(name).props.accessibilityState?.busy;

// Holds the next request until the returned release() is called, to see the loading state
function holdNextRequest() {
    const real = backend.fetch.getMockImplementation();
    let release = null;
    backend.fetch.mockImplementationOnce((...args) => new Promise((resolve) => (release = () => resolve(real(...args)))));
    return async () => {
        await waitFor(() => expect(release).not.toBeNull()); // the request has started
        await act(async () => release());
    };
}

async function openForgotPassword() {
    await render(<TestApp />);
    await press("Forgot password?");
    await waitForScreen("/forgot_password", "Mobile Number");
}

async function sendCode(phone = PHONE) {
    await fill({ "Mobile Number": phone });
    await tap("Send Code");
    await screen.findByText("6-digit Code");
}

async function enterCode(code) {
    await fill({ "6-digit Code": code });
    await tap("Verify Code");
}

async function toPasswordStep() {
    await openForgotPassword();
    await sendCode();
    await enterCode(backend.smsOutbox.at(-1).code);
    await screen.findByText("Choose a new password.");
}

async function chooseNewPassword(password = NEW_PASSWORD, confirm = password) {
    await fill({ "New Password": password, "Confirm Password": confirm });
    await tap("Save Password");
}

describe("forgot password: happy path", () => {
    it("number -> code -> new password -> login with it", async () => {
        await render(<TestApp />);
        await press("Forgot password?");
        await waitForScreen("/forgot_password", "Mobile Number");
        expect(screen.getByText(/We'll text you a code/)).toBeTruthy();

        // ---- number (typed with spaces): loading, then the code step ----
        await fill({ "Mobile Number": "0917 123 4567" });
        const release = holdNextRequest();
        const tapping = tap("Send Code"); // not awaited: the press waits for the (held) request
        await waitFor(() => expect(isBusy("Send Code")).toBe(true)); // spinner while sending
        expect(screen.queryByText("6-digit Code")).toBeNull();
        await release();
        await tapping;
        await screen.findByText("6-digit Code");
        expect(screen.getByText("We sent a 6-digit code to +63 917 123 4567.")).toBeTruthy();
        expect(screen.getByText(/^Resend code in \d+s$/)).toBeTruthy();
        expect(backend.smsOutbox).toEqual([{ phone: PHONE, code: expect.stringMatching(/^\d{6}$/) }]);

        // ---- code ----
        await enterCode(backend.smsOutbox[0].code);
        await screen.findByText("Choose a new password.");

        // ---- new password: then Login, with a confirmation ----
        await chooseNewPassword();
        await waitForScreen("/login", "Password updated. Log in with your new password.");
        expect(navigation.params).toEqual({ reset: "done" });

        // ---- the old password no longer works, the new one does ----
        await fill({ Username: "maria", Password: "Old#Passw0rd" });
        await press("Login");
        await screen.findByText("Invalid username or password.");
        await fill({ Password: NEW_PASSWORD });
        await press("Login");
        await waitForScreen("/passenger/home");
        expect(user.password).toBe(NEW_PASSWORD);
    });

    it("signs out every existing session of the account", async () => {
        const before = backend.tokensFor(user).access;
        await toPasswordStep();
        await chooseNewPassword();
        await waitForScreen("/login");
        const res = await backend.fetch("passenger/me/", { headers: { Authorization: `Bearer ${before}` } });
        expect(res.status).toBe(401);
    });

    it("Back to Login leaves the flow", async () => {
        await openForgotPassword();
        await press("Back to Login");
        await waitForScreen("/login", "Sign In and Continue");
    });
});

describe("forgot password: number step", () => {
    it("an invalid number is flagged without calling the server", async () => {
        await openForgotPassword();
        await fill({ "Mobile Number": "12345" });
        await tap("Send Code");
        expect(screen.getByText("Enter a valid mobile number (e.g. 09123456789)")).toBeTruthy();
        expect(backend.requests.some((r) => r.path.startsWith("user/sms-reset/"))).toBe(false);
    });

    it("an unknown number says no account uses it and stays on the number", async () => {
        await openForgotPassword();
        await fill({ "Mobile Number": "09990000000" });
        await tap("Send Code");
        await screen.findByText("No account is registered with this number.");
        expect(backend.smsOutbox).toEqual([]);
        expect(screen.queryByText("6-digit Code")).toBeNull();
    });

    it("SMS provider failure: says so and stays on the number", async () => {
        backend.smsFails = true;
        await openForgotPassword();
        await fill({ "Mobile Number": PHONE });
        await tap("Send Code");
        await screen.findByText("We couldn't send the code. Please try again in a moment.");
        expect(screen.queryByText("6-digit Code")).toBeNull();

        backend.smsFails = false; // try again straight away
        await tap("Send Code");
        await screen.findByText("6-digit Code");
    });

    it("no connection: the network message", async () => {
        await openForgotPassword();
        await fill({ "Mobile Number": PHONE });
        backend.offlineNext();
        await tap("Send Code");
        await screen.findByText(ERROR_MESSAGES.network);
        expect(isBusy("Send Code")).toBe(false); // the spinner stops
    });

    it("hourly limit reached: the server's message, no code step", async () => {
        jest.useFakeTimers({ now: new Date("2026-11-06T09:00:00+08:00") });
        await openForgotPassword();
        for (let i = 0; i < 3; i++) {
            await sendCode();
            await press("Change number");
            await act(async () => jest.advanceTimersByTime(61_000));
        }
        await fill({ "Mobile Number": PHONE });
        await tap("Send Code");
        await screen.findByText("Too many code requests for this number. Try again in an hour.");
        expect(screen.queryByText("6-digit Code")).toBeNull();
        expect(backend.smsOutbox).toHaveLength(3);
    });

    it("sending again within the cooldown opens the code step with the wait", async () => {
        await openForgotPassword();
        await sendCode();
        await press("Change number");
        await tap("Send Code"); // same number, seconds later
        await screen.findByText("Please wait 60 seconds before requesting a new code.");
        expect(screen.getByText("6-digit Code")).toBeTruthy();
        expect(screen.getByText(/^Resend code in \d+s$/)).toBeTruthy();
        expect(backend.smsOutbox).toHaveLength(1);
    });
});

describe("forgot password: code step", () => {
    it("resend counts down from 60 s and only then sends a new code", async () => {
        jest.useFakeTimers({ now: new Date("2026-11-06T09:00:00+08:00") });
        await openForgotPassword();
        await sendCode();
        expect(screen.getByText("Resend code in 60s")).toBeTruthy();
        expect(button("Resend code in 60s").props.accessibilityState).toMatchObject({ disabled: true });

        await act(async () => jest.advanceTimersByTime(1000));
        expect(screen.getByText("Resend code in 59s")).toBeTruthy();
        await fireEvent.press(screen.getByText("Resend code in 59s"));
        expect(backend.smsOutbox).toHaveLength(1); // disabled: nothing sent

        for (let i = 0; i < 59; i++) await act(async () => jest.advanceTimersByTime(1000));
        expect(screen.getByText("Resend code")).toBeTruthy();
        await fireEvent.press(screen.getByText("Resend code"));
        await waitFor(() => expect(backend.smsOutbox).toHaveLength(2));
        await screen.findByText("Resend code in 60s"); // counting again
    });

    it("a code that isn't 6 digits is flagged without calling the server", async () => {
        await openForgotPassword();
        await sendCode();
        const before = backend.requests.length;
        await enterCode("123");
        expect(screen.getByText("Enter the 6-digit code")).toBeTruthy();
        expect(backend.requests).toHaveLength(before);
    });

    it("a wrong code shows the error and clears the field", async () => {
        backend.nextSmsCode = "482913";
        await openForgotPassword();
        await sendCode();
        await enterCode("000000");
        await screen.findByText("Invalid or expired code.");
        expect(screen.queryByDisplayValue("000000")).toBeNull();
        expect(screen.queryByText("Choose a new password.")).toBeNull();
    });

    it("five wrong codes lock it, even the right one", async () => {
        backend.nextSmsCode = "482913";
        await openForgotPassword();
        await sendCode();
        for (let i = 0; i < 4; i++) {
            await enterCode("000000");
            await screen.findByText("Invalid or expired code.");
        }
        await enterCode("000000");
        await screen.findByText("Too many wrong attempts. Request a new code.");
        await enterCode("482913");
        await screen.findByText("Too many wrong attempts. Request a new code.");
    });

    it("an expired code (after 5 minutes) is refused", async () => {
        jest.useFakeTimers({ now: new Date("2026-11-06T09:00:00+08:00") });
        await openForgotPassword();
        await sendCode();
        const { code } = backend.smsOutbox.at(-1);
        await act(async () => jest.advanceTimersByTime(5 * 60_000 + 1000));
        await enterCode(code);
        await screen.findByText("Invalid or expired code.");
    });

    it("a used code can't be used again", async () => {
        await toPasswordStep();
        const { code } = backend.smsOutbox.at(-1);
        const res = await backend.fetch("user/sms-reset/verify/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: PHONE, otp: code }),
        });
        expect(res.status).toBe(400);
    });
});

describe("forgot password: new password step", () => {
    it("weak or mismatched passwords are flagged before sending", async () => {
        await toPasswordStep();
        const before = backend.requests.length;
        await chooseNewPassword("weakpass");
        expect(screen.getByText("Must contain at least 1 uppercase letter")).toBeTruthy();
        await chooseNewPassword(NEW_PASSWORD, "Different#123");
        expect(screen.getByText("Passwords do not match")).toBeTruthy();
        expect(backend.requests).toHaveLength(before);
    });

    it("a password the server refuses shows its rule, and can be fixed", async () => {
        await toPasswordStep();
        // passes the app's checks; the (fake) server says otherwise for one try
        const real = backend.fetch.getMockImplementation();
        backend.fetch.mockImplementationOnce(async () => ({
            status: 400,
            ok: false,
            json: async () => ({ password: ["This password is too common."], error: "This password is too common." }),
        }));
        await chooseNewPassword();
        await screen.findByText("This password is too common.");
        backend.fetch.mockImplementation(real);
        await chooseNewPassword();
        await waitForScreen("/login", "Password updated. Log in with your new password.");
    });

    it("an expired reset session (after 10 minutes) offers to start again", async () => {
        jest.useFakeTimers({ now: new Date("2026-11-06T09:00:00+08:00") });
        await toPasswordStep();
        await act(async () => jest.advanceTimersByTime(10 * 60_000 + 1000));
        await chooseNewPassword();
        await screen.findByText("Your reset session has expired. Start again.");
        expect(user.password).toBe("password123");
        await tap("Start Again");
        await screen.findByText("Mobile Number");
    });

    it("no connection while saving: the network message, still on the step", async () => {
        await toPasswordStep();
        backend.offlineNext();
        await chooseNewPassword();
        await screen.findByText(ERROR_MESSAGES.network);
        expect(route()).toBe("/forgot_password");
        expect(screen.getByText("Choose a new password.")).toBeTruthy();
    });
});

describe("forgot password: nothing secret leaves the server", () => {
    it("no code or password in any response the app receives", async () => {
        const bodies = [];
        const real = backend.fetch.getMockImplementation();
        backend.fetch.mockImplementation(async (...args) => {
            const res = await real(...args);
            const body = await res.json().catch(() => null);
            bodies.push(JSON.stringify(body));
            return { ...res, json: async () => body };
        });
        await toPasswordStep();
        await chooseNewPassword();
        await waitForScreen("/login");
        const all = bodies.join(" ");
        expect(all).not.toContain(backend.smsOutbox[0].code);
        expect(all).not.toContain(NEW_PASSWORD);
    });
});
