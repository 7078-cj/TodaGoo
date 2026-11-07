// KeyboardAwareScrollView (components/layouts): a focused FormTextField is scrolled above the keyboard.
// The keyboard events are captured from Keyboard.addListener and fired by the test; the field's
// on-screen position comes from a stand-in for utils/measure (no native layout under Jest).
import React from "react";
import { Keyboard, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import KeyboardAwareScrollView, { useKeyboardVisible } from "../../components/layouts/KeyboardAwareScrollView";
import FormTextField from "../../components/inputs/FormTextField";
import RegisterLayout from "../../components/RegisterLayout";
import { measureInWindow } from "../../utils/measure";

jest.mock("../../utils/measure", () => ({ measureInWindow: jest.fn() }));

let handlers;
let listeners;
beforeEach(() => {
    jest.useFakeTimers();
    handlers = {};
    listeners = jest.spyOn(Keyboard, "addListener").mockImplementation((event, cb) => {
        (handlers[event] ??= []).push(cb);
        return { remove: () => (handlers[event] = handlers[event].filter((h) => h !== cb)) };
    });
    measureInWindow.mockReset();
});
afterEach(() => {
    listeners.mockRestore();
    jest.useRealTimers();
});

// jest-expo runs as iOS: keyboardWillShow / keyboardWillHide
const keyboardShows = (screenY) =>
    act(async () => {
        (handlers.keyboardWillShow ?? []).forEach((h) => h({ endCoordinates: { screenY } }));
        await jest.advanceTimersByTimeAsync(300);
    });
const keyboardHides = () =>
    act(async () => {
        (handlers.keyboardWillHide ?? []).forEach((h) => h({}));
    });
const focus = (label) =>
    act(async () => {
        const input = screen.getByText(label).parent.queryAll((n) => n.type === "TextInput")[0];
        fireEvent(input, "focus");
        await jest.advanceTimersByTimeAsync(300);
    });

async function renderForm(extraSpace) {
    const ref = React.createRef();
    await render(
        <KeyboardAwareScrollView ref={ref} testID="form" {...(extraSpace != null && { extraSpace })}>
            <FormTextField label="Username" value="" onChangeText={() => {}} />
            <FormTextField label="Confirm Password" value="" onChangeText={() => {}} secure />
        </KeyboardAwareScrollView>
    );
    const scrollTo = jest.fn();
    ref.current.scrollTo = scrollTo;
    return { scrollTo };
}

describe("KeyboardAwareScrollView", () => {
    it("scrolls a field the keyboard would cover just above it (plus room below)", async () => {
        const { scrollTo } = await renderForm();
        measureInWindow.mockResolvedValue({ x: 0, y: 600, width: 300, height: 70 });
        await focus("Confirm Password");
        await keyboardShows(500); // keyboard top at y=500
        // 600 + 70 + 80 (extraSpace) - 500 = 250
        expect(scrollTo).toHaveBeenLastCalledWith({ y: 250, animated: true });
    });

    it("adds to how far it has already scrolled", async () => {
        const { scrollTo } = await renderForm(0);
        await fireEvent.scroll(screen.getByTestId("form"), { nativeEvent: { contentOffset: { y: 100 } } });
        measureInWindow.mockResolvedValue({ x: 0, y: 520, width: 300, height: 50 });
        await focus("Confirm Password");
        await keyboardShows(500);
        expect(scrollTo).toHaveBeenLastCalledWith({ y: 170, animated: true }); // 100 + (520 + 50 - 500)
    });

    it("leaves a field that's already visible alone", async () => {
        const { scrollTo } = await renderForm();
        measureInWindow.mockResolvedValue({ x: 0, y: 100, width: 300, height: 70 });
        await focus("Username");
        await keyboardShows(500);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("moving to the next field while the keyboard is open scrolls to it", async () => {
        const { scrollTo } = await renderForm();
        measureInWindow.mockResolvedValue({ x: 0, y: 100, width: 300, height: 70 });
        await focus("Username");
        await keyboardShows(500);
        expect(scrollTo).not.toHaveBeenCalled();

        measureInWindow.mockResolvedValue({ x: 0, y: 480, width: 300, height: 70 });
        await focus("Confirm Password");
        expect(scrollTo).toHaveBeenLastCalledWith({ y: 130, animated: true }); // 480 + 70 + 80 - 500
    });

    it("measures the whole field (label, input, error), not just the input", async () => {
        await renderForm();
        measureInWindow.mockResolvedValue({ x: 0, y: 100, width: 300, height: 70 });
        await focus("Confirm Password");
        await keyboardShows(500);
        const measured = measureInWindow.mock.calls.at(-1)[0];
        expect(measured).toBeTruthy();
        expect(measured.type ?? measured.viewConfig?.uiViewClassName ?? "View").not.toBe("TextInput");
    });

    it("does nothing with the keyboard closed, or after it closes", async () => {
        const { scrollTo } = await renderForm();
        measureInWindow.mockResolvedValue({ x: 0, y: 800, width: 300, height: 70 });
        await focus("Confirm Password"); // focus, but no keyboard event yet
        expect(scrollTo).not.toHaveBeenCalled();
        await keyboardShows(500);
        await keyboardHides();
        scrollTo.mockClear();
        await focus("Username");
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("FormTextField's own onFocus still runs", async () => {
        const onFocus = jest.fn();
        await render(
            <KeyboardAwareScrollView>
                <FormTextField label="Address" value="" onChangeText={() => {}} onFocus={onFocus} />
            </KeyboardAwareScrollView>
        );
        await focus("Address");
        expect(onFocus).toHaveBeenCalledTimes(1);
    });

    it("FormTextField works outside it too", async () => {
        const onFocus = jest.fn();
        await render(<FormTextField label="Address" value="" onChangeText={() => {}} onFocus={onFocus} />);
        await focus("Address");
        expect(onFocus).toHaveBeenCalledTimes(1);
        expect(measureInWindow).not.toHaveBeenCalled();
    });
});

describe("useKeyboardVisible", () => {
    function Probe() {
        return <Text>{useKeyboardVisible() ? "open" : "closed"}</Text>;
    }

    it("follows the keyboard", async () => {
        await render(<Probe />);
        expect(screen.getByText("closed")).toBeTruthy();
        await keyboardShows(500);
        expect(screen.getByText("open")).toBeTruthy();
        await keyboardHides();
        expect(screen.getByText("closed")).toBeTruthy();
    });
});

describe("RegisterLayout while typing", () => {
    const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

    it("hides the tagline (and picture) while the keyboard is open, shows them after", async () => {
        await render(
            <SafeAreaProvider initialMetrics={METRICS}>
                <RegisterLayout tagline="Sign Up As A Passenger">
                    <FormTextField label="Address" value="" onChangeText={() => {}} />
                </RegisterLayout>
            </SafeAreaProvider>
        );
        expect(screen.getByText("Sign Up As A Passenger")).toBeTruthy();
        await keyboardShows(500);
        expect(screen.queryByText("Sign Up As A Passenger")).toBeNull();
        expect(screen.getByText("TodaGoo")).toBeTruthy(); // the slim header stays
        await keyboardHides();
        expect(screen.getByText("Sign Up As A Passenger")).toBeTruthy();
    });
});
