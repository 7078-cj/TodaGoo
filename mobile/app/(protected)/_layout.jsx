import { Stack, Redirect, router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, View } from "react-native";
import BottomNav from "../../components/layouts/BottomNav";
import Header from "../../components/layouts/Header";
import { ProfileProvider } from "../../contexts/ProfileContext";

// Works out "driver" | "passenger" from the stored user. Adjust to match
// whatever your login actually saves.
function getRole(user) {
    const explicit = user?.role ?? user?.user_type;
    if (typeof explicit === "string") return explicit.toLowerCase();
    if (user?.driver_profile) return "driver";
    if (user?.passenger_profile) return "passenger";
    return null;
}

export default function ProtectedLayout() {
    // status: "checking" | "unauthenticated" | "unverified" | "ok"
    // `path` records which route the status was computed for, so a result
    // from an earlier route is never acted on after navigation.
    const [auth, setAuth] = useState({ status: "checking", path: null, role: null });

    const segments = useSegments();
    const path = segments.join("/");

    useEffect(() => {
        let cancelled = false;

        const checkAuth = async () => {
            let status;
            let role = null;
            try {
                const raw = await AsyncStorage.getItem("user");
                const parsedUser = raw ? JSON.parse(raw) : null;

                if (!parsedUser) status = "unauthenticated";
                else if (parsedUser.verified === false) status = "unverified";
                else status = "ok";

                role = getRole(parsedUser);
            } catch {
                // Corrupt or unreadable storage: treat as logged out
                status = "unauthenticated";
            }
            if (!cancelled) setAuth({ status, path, role });
        };

        checkAuth();
        return () => {
            cancelled = true;
        };
    }, [path]);

    // Only redirect on a status that was computed for the current route.
    // Otherwise, right after OTP succeeds, the old "unverified" status is still
    // in state while the route is already /home, and it would bounce back to OTP.
    useEffect(() => {
        if (
            auth.status === "unverified" &&
            auth.path === path &&
            !path.endsWith("otp")
        ) {
            router.replace("/(protected)/otp");
        }
    }, [auth, path]);

    if (auth.status === "checking") {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <Text className="text-dark">Checking authentication...</Text>
            </View>
        );
    }

    if (auth.status === "unauthenticated") {
        return <Redirect href="/(global)/login" />;
    }

    const isReady = auth.status === "ok" && auth.path === path;

    return (
        // Role is only passed once the user is verified, so no profile
        // request is made while they're stuck on OTP. If the role is null
        // the provider just clears the profile and skips the fetch.
        <ProfileProvider role={auth.status === "ok" ? auth.role : null}>
            {isReady && <Header />}
            <Stack screenOptions={{ headerShown: false }} />
            {/* Hide the nav while the user is stuck on OTP verification */}
            {isReady && <BottomNav />}
        </ProfileProvider>
    );
}