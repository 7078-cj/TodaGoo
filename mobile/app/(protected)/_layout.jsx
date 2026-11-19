import { Stack, Redirect, router, useSegments } from "expo-router";
import { useContext, useEffect, useMemo } from "react";
import BottomNav from "../../components/layouts/BottomNav";
import Header from "../../components/layouts/Header";
import AuthContext from "../../contexts/AuthContext";
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
    // Single source of truth: AuthContext (hydrated from storage by AuthProvider,
    // updated by login and by the OTP screen).
    const { user, authHydrated } = useContext(AuthContext);

    const auth = useMemo(() => {
        if (!authHydrated) return { status: "checking", role: null };
        if (!user) return { status: "unauthenticated", role: null };
        return {
            status: user.verified === false ? "unverified" : "ok",
            role: getRole(user),
        };
    }, [user, authHydrated]);

    const segments = useSegments();
    const isOtpRoute = segments.includes("otp");
    // screens that render their own PageHeader instead of the "Hello" Header
    const hasOwnHeader = ["history", "profile", "edit_profile", "complete", "notifications"].some((s) =>
        segments.includes(s)
    );

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