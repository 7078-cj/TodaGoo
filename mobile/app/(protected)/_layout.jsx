import { Stack, Redirect, router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, View } from "react-native";
import BottomNav from "../../components/layouts/BottomNav";

export default function ProtectedLayout() {
    // "checking" | "unauthenticated" | "unverified" | "ok"
    const [status, setStatus] = useState("checking");
    const segments = useSegments();
    const path = segments.join("/");

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const raw = await AsyncStorage.getItem("user");
                const parsedUser = raw ? JSON.parse(raw) : null;

                // Check for a missing user first, before reading any property on it
                if (!parsedUser) {
                    setStatus("unauthenticated");
                } else if (parsedUser.verified === false) {
                    setStatus("unverified");
                } else {
                    setStatus("ok");
                }
            } catch {
                // Corrupt or unreadable storage: treat as logged out
                setStatus("unauthenticated");
            }
        };

        checkAuth();
    }, [path]);

    // Navigate to the OTP screen only once the Stack below is mounted
    useEffect(() => {
        if (status === "unverified" && !path.endsWith("otp")) {
            router.replace("/(protected)/otp");
        }
    }, [status, path]);

    if (status === "checking") {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <Text className="text-dark">Checking authentication...</Text>
            </View>
        );
    }

    if (status === "unauthenticated") {
        return <Redirect href="/(global)/login" />;
    }

    return (
        <>
            <Stack screenOptions={{ headerShown: false }} />
            {/* Hide the nav while the user is stuck on OTP verification */}
            {status === "ok" && <BottomNav />}
        </>
    );
}