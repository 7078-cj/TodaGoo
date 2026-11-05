// <TestApp>: the app's screens behind the same providers as the real layouts, showing the screen for
// the current path of the router mock (screenMocks.js). A screen's router.push / replace moves the
// flow on, the way expo-router would:
//   app/_layout.jsx                 SafeAreaProvider + AuthProvider
//   app/(protected)/_layout.jsx     ProfileProvider + NotificationProvider
//   app/(protected)/passenger/      PassengerProvider
//   app/(protected)/driver/         DriverProvider + NewBookingModal
// The header / bottom tabs of the protected layout aren't rendered.
import React, { useContext } from "react";
import { Text } from "react-native";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthContext, { AuthProvider } from "../../contexts/AuthContext";
import { ProfileProvider } from "../../contexts/ProfileContext";
import { NotificationProvider } from "../../contexts/NotificationContext";
import { PassengerProvider } from "../../contexts/PassengerContext";
import { DriverProvider } from "../../contexts/DriverContext";
import NewBookingModal from "../../components/NewBookingModal";
import { usePath } from "./screenMocks";

// path without route groups → screen; "/(protected)/passenger/home" is "/passenger/home"
const SCREENS = {
    "/": () => require("../../app/index").default,
    "/login": () => require("../../app/(global)/login").default,
    "/choose_a_role": () => require("../../app/(global)/choose_a_role").default,
    "/register/passenger": () => require("../../app/(global)/register/passenger").default,
    "/register/driver": () => require("../../app/(global)/register/driver").default,
    "/otp": () => require("../../app/(protected)/otp").default,
    "/history": () => require("../../app/(protected)/history").default,
    "/passenger/home": () => require("../../app/(protected)/passenger/home").default,
    "/passenger/book": () => require("../../app/(protected)/passenger/book").default,
    "/passenger/en_route": () => require("../../app/(protected)/passenger/en_route").default,
    "/passenger/complete": () => require("../../app/(protected)/passenger/complete").default,
    "/driver/home": () => require("../../app/(protected)/driver/home").default,
    "/driver/en_route": () => require("../../app/(protected)/driver/en_route").default,
    "/driver/complete": () => require("../../app/(protected)/driver/complete").default,
};

export const routeOf = (path) => "/" + path.split("/").filter((s) => s && !s.startsWith("(")).join("/");

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function Routes() {
    const path = routeOf(usePath());
    const { user } = useContext(AuthContext);
    const load = SCREENS[path];
    if (!load) return <Text>{`No screen for ${path}`}</Text>;
    const Screen = load();
    const screenEl = <Screen key={path} />;

    const [section] = path.split("/").filter(Boolean);
    const isProtected = ["otp", "history", "passenger", "driver"].includes(section);
    if (!isProtected) return screenEl;

    // ProtectedLayout gives ProfileProvider the role of the logged-in user
    return (
        <ProfileProvider role={user?.role}>
            <NotificationProvider>
                {section === "passenger" ? (
                    <PassengerProvider>{screenEl}</PassengerProvider>
                ) : section === "driver" ? (
                    <DriverProvider>
                        <NewBookingModal />
                        {screenEl}
                    </DriverProvider>
                ) : (
                    screenEl
                )}
            </NotificationProvider>
        </ProfileProvider>
    );
}

export function TestApp() {
    return (
        <SafeAreaProvider initialMetrics={METRICS}>
            <AuthProvider>
                <Routes />
            </AuthProvider>
        </SafeAreaProvider>
    );
}

// ---- screen helpers ----

// The text input under a FormTextField label ("Username", "Contact Number", ...)
export function field(label) {
    const [box] = screen.getAllByText(label).map((t) => t.parent).filter((p) => p.queryAll((n) => n.type === "TextInput").length);
    if (!box) throw new Error(`No text field labelled "${label}"`);
    return box.queryAll((n) => n.type === "TextInput")[0];
}

export async function fill(values) {
    for (const [label, value] of Object.entries(values)) await fireEvent.changeText(field(label), value);
}

// Tap the button showing `text`; when the text appears more than once ("You must be Ready" + the
// Ready button) the one inside something pressable wins
export function press(text) {
    const matches = screen.getAllByText(text);
    const pressable = (node) => {
        for (let n = node; n; n = n.parent) if (n.props?.onPress || n.props?.onClick) return true;
        return false;
    };
    const target = matches.filter(pressable).at(-1) ?? matches.at(-1);
    return fireEvent.press(target);
}

// Wait until the router mock is on `route` (e.g. "/otp") and its screen has rendered `text`
export async function waitForScreen(route, text, timeout = 3000) {
    const { navigation } = require("./screenMocks");
    await waitFor(() => expect(routeOf(navigation.path)).toBe(route), { timeout });
    if (text) await screen.findAllByText(text, {}, { timeout });
}

// Pick a photo for a PickImageComponent ("Profile Picture", "Vehicle Front", ...)
export async function choosePhoto(label) {
    // PickImageComponent renders <Text>{label}</Text> then the upload box, side by side
    const labelText = screen.getAllByText(label).find((t) => t.parent?.children.includes(t));
    const siblings = labelText.parent.children;
    const box = siblings.slice(siblings.indexOf(labelText) + 1).find((n) => typeof n !== "string");
    if (!box) throw new Error(`No photo box after "${label}"`);
    await fireEvent.press(within(box).queryAllByText("Click to Upload")[0] ?? box);
    await fireEvent.press(await screen.findByText("Choose from Gallery"));
}

// All text on the screen, for debugging a failing step
export function screenText() {
    const out = [];
    const walk = (n) => {
        if (n == null) return;
        if (typeof n === "string") out.push(n);
        else if (Array.isArray(n)) n.forEach(walk);
        else walk(n.children);
    };
    walk(screen.toJSON());
    return out.join(" | ");
}
