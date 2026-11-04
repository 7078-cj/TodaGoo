import { Stack, Redirect, router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNav from "../../components/layouts/BottomNav";
import Header from "../../components/layouts/Header";
import { ProfileProvider } from "../../contexts/ProfileContext";
import { LoadingScreen } from "../../components/loading";
import { LOADING_MESSAGES } from "../../constants/loading";
import { NotificationProvider } from "../../contexts/NotificationContext";
import NotificationToast from "../../components/NotificationToast";
import BackgroundWork from "../../components/BackgroundWork";

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
    // screens that render their own PageHeader instead of the "Hello" Header
    const hasOwnHeader = ["history", "profile", "edit_profile", "complete", "notifications"].some((s) => segments.includes(s));

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
        return <LoadingScreen message={LOADING_MESSAGES.auth} />;
    }

    if (auth.status === "unauthenticated") {
        return <Redirect href="/(global)/login" />;
    }

    if (auth.status === "unverified" && !isOtpRoute) {
        return <LoadingScreen message={LOADING_MESSAGES.redirect} />;
    }

    return (
        <ProfileProvider role={auth.status === "ok" ? auth.role : null}>
            <NotificationProvider>
                {!isOtpRoute && !hasOwnHeader && <Header />}

                <Stack
                    screenOptions={{
                        headerShown: false,
                        animation: "fade",
                        animationDuration: 180,
                    }}
                />

                {!isOtpRoute && <BottomNav />}
                {!isOtpRoute && <NotificationToast />}
                {/* background notification check + phone-notification taps */}
                {auth.status === "ok" && <BackgroundWork />}
            </NotificationProvider>
        </ProfileProvider>
    );
}
