// One place to configure the splash screen and every loading state in the app.
// Components: components/loading (AppSplash, LoadingScreen, LoadingOverlay, InlineLoader, Spinner).
import colors from "./colors";

// Shown on app start until the saved login is checked and the first screen is ready.
// Keep backgroundColor / logo in sync with the "expo-splash-screen" plugin in app.json,
// so the native splash hands over to this one without a flash.
export const SPLASH = {
    logo: require("../assets/Welcome.png"),
    logoWidth: 220,               // px; height follows the image's aspect ratio
    backgroundColor: colors.background,
    showAppName: true,            // "TodaGoo" under the logo
    appName: "TodaGoo",
    appNameColor: colors.primary,
    showSpinner: true,
    spinnerColor: colors.primary,
    minDurationMs: 1200,          // keep the splash up at least this long (no flicker on fast starts)
    fadeOutMs: 300,
};

// Full-screen and inline loaders
export const LOADING = {
    backgroundColor: colors.background,
    spinnerColor: colors.primary,
    spinnerSize: "large",         // "small" | "large"
    textColor: colors.dark,
    // LoadingScreen can show a small logo above the spinner (showLogo prop)
    logo: SPLASH.logo,
    logoWidth: 120,
};

// Blocking overlay for actions ("Finding you a driver...")
export const OVERLAY = {
    backdropColor: "rgba(0,0,0,0.45)",
    cardColor: colors.surface,
    spinnerColor: colors.primary,
    textColor: colors.dark,
    actionColor: colors.error,
};

// Default texts; pass `message` to override
export const LOADING_MESSAGES = {
    default: "Loading...",
    auth: "Checking your account...",
    redirect: "Redirecting to verification...",
    booking: "Loading your ride...",
    profile: "Loading your profile...",
    history: "Loading your rides...",
    reports: "Loading your reports...",
    earnings: "Loading your earnings...",
    notifications: "Loading notifications...",
    map: "Loading map...",
    findingDriver: "Finding you a driver...",
    driverStatus: "Checking your status...",
};
