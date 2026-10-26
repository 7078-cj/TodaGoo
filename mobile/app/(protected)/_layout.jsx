import { Stack, Redirect, router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, View } from "react-native";
import BottomNav from "../../components/layouts/BottomNav";

export default function ProtectedLayout() {
    // status: "checking" | "unauthenticated" | "unverified" | "ok"
    // `path` records which route the status was computed for, so a result
    // from an earlier route is never acted on after navigation.
    const [auth, setAuth] = useState({ status: "checking", path: null });
    const segments = useSegments();
    const path = segments.join("/");

    useEffect(() => {
        let cancelled = false;

        const checkAuth = async () => {
            let status;
            try {
                const raw = await AsyncStorage.getItem("user");
                const parsedUser = raw ? JSON.parse(raw) : null;

                if (!parsedUser) status = "unauthenticated";
                else if (parsedUser.verified === false) status = "unverified";
                else status = "ok";
            } catch {
                // Corrupt or unreadable storage: treat as logged out
                status = "unauthenticated";
            }
            if (!cancelled) setAuth({ status, path });
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

    return (
        <>
            <Stack screenOptions={{ headerShown: false }} />
            {/* Hide the nav while the user is stuck on OTP verification */}
            {auth.status === "ok" && auth.path === path && <BottomNav />}
        </>
    );
}