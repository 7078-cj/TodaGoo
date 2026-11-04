import React, { useEffect, useState } from "react";
import { Animated, Image, Text, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Spinner from "./Spinner";
import { SPLASH } from "../../constants/loading";

// Keep the native splash up until this one has drawn (called once, at import)
SplashScreen.preventAutoHideAsync().catch(() => {});

// In-app splash: logo in the middle, drawn over the app until `ready` is true, then fades out.
// It stays up for at least SPLASH.minDurationMs, and takes over seamlessly from the native splash
// (same background / logo: keep app.json's expo-splash-screen plugin in sync with SPLASH).
export default function AppSplash({ ready }) {
    const [startedAt] = useState(() => Date.now());
    const [hidden, setHidden] = useState(false);
    const [opacity] = useState(() => new Animated.Value(1));
    const logo = Image.resolveAssetSource(SPLASH.logo);

    useEffect(() => {
        if (!ready) return;
        const wait = Math.max(0, SPLASH.minDurationMs - (Date.now() - startedAt));
        const timer = setTimeout(() => {
            Animated.timing(opacity, { toValue: 0, duration: SPLASH.fadeOutMs, useNativeDriver: true }).start(() => setHidden(true));
        }, wait);
        return () => clearTimeout(timer);
    }, [ready, startedAt, opacity]);

    if (hidden) return null;

    return (
        <Animated.View
            pointerEvents={ready ? "none" : "auto"}
            accessibilityLabel={`${SPLASH.appName} is starting`}
            style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: SPLASH.backgroundColor, opacity }]}
            onLayout={() => SplashScreen.hideAsync().catch(() => {})}
        >
            <Image
                source={SPLASH.logo}
                style={{ width: SPLASH.logoWidth, height: (SPLASH.logoWidth * logo.height) / logo.width }}
                resizeMode="contain"
            />
            {SPLASH.showAppName ? (
                <Text style={[styles.appName, { color: SPLASH.appNameColor }]}>{SPLASH.appName}</Text>
            ) : null}
            {SPLASH.showSpinner ? <Spinner color={SPLASH.spinnerColor} style={styles.spinner} /> : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: "center", justifyContent: "center", zIndex: 1000, elevation: 1000 },
    appName: { marginTop: 16, fontSize: 34, fontWeight: "700" },
    spinner: { marginTop: 28 },
});
