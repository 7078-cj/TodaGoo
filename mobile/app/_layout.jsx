
import "react-native-get-random-values";
import { Stack, router } from "expo-router";
import "../global.css";
import AuthContext, { AuthProvider } from "@/contexts/AuthContext";
import { useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateToken } from "@/api/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetworkStatus from "@/components/NetworkStatus";
import { AppSplash } from "@/components/loading";
import { ErrorBoundary } from "@/components/feedback";

function RootNavigator() {
  const { setToken, setUser, logoutUser } = useContext(AuthContext);
  // splash stays up until the saved login is checked and the first screen is chosen
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await AsyncStorage.getItem("user");
        const parsedUser = user ? JSON.parse(user) : null;

        if (!parsedUser) {
          router.replace("/");
          return;
        }

        await updateToken(setToken, setUser, logoutUser);

        if (parsedUser.role === "passenger") {
          router.replace("/(protected)/passenger/home");
        } else {
          router.replace("/(protected)/driver/home");
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        router.replace("/");
      } finally {
        setReady(true);
      }
    };

    checkAuth();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <AppSplash ready={ready} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* a crash in any screen shows a recovery screen instead of a blank / red one */}
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
        <NetworkStatus />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
