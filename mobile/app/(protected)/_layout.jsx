import { Stack, Redirect, router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, View } from "react-native";
import BottomNav from "../../components/layouts/BottomNav";
import Header from "../../components/layouts/Header";
import { ProfileProvider } from "../../contexts/ProfileContext";

function getRole(user) {
    const explicit = user?.role ?? user?.user_type;

    if (typeof explicit === "string") {
        return explicit.toLowerCase();
    }

    if (user?.driver_profile) return "driver";
    if (user?.passenger_profile) return "passenger";

    return null;
}

export default function ProtectedLayout() {
    const [auth, setAuth] = useState({
        status: "checking",
        role: null,
    });

    const segments = useSegments();
    const path = segments.join("/");
    const isOtpRoute = segments.includes("otp");

    useEffect(() => {
        let cancelled = false;

        const checkAuth = async () => {
            try {
                const raw = await AsyncStorage.getItem("user");
                const user = raw ? JSON.parse(raw) : null;

                if (!user) {
                    if (!cancelled) {
                        setAuth({ status: "unauthenticated", role: null });
                    }
                    return;
                }

                const role = getRole(user);

                if (!cancelled) {
                    setAuth({
                        status: user.verified === false ? "unverified" : "ok",
                        role,
                    });
                }
            } catch {
                if (!cancelled) {
                    setAuth({ status: "unauthenticated", role: null });
                }
            }
        };

        checkAuth();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (auth.status === "unverified" && !isOtpRoute) {
            router.replace("/(protected)/otp");
        }
    }, [auth.status, isOtpRoute]);

    if (auth.status === "checking") {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <Text className="text-dark">
                    Checking authentication...
                </Text>
            </View>
        );
    }

    if (auth.status === "unauthenticated") {
        return <Redirect href="/(global)/login" />;
    }

    if (auth.status === "unverified" && !isOtpRoute) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <Text className="text-dark">
                    Redirecting to verification...
                </Text>
            </View>
        );
    }

    return (
        <ProfileProvider role={auth.status === "ok" ? auth.role : null}>
            {!isOtpRoute && <Header />}

            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: "fade",
                    animationDuration: 180,
                }}
            />

            {!isOtpRoute && <BottomNav />}
        </ProfileProvider>
    );
}
