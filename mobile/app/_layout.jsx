
import "react-native-get-random-values";
import { Stack, router } from "expo-router";
import "../global.css";
import AuthContext, { AuthProvider } from "@/contexts/AuthContext";
import { useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateToken } from "@/api/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetworkStatus from "@/components/NetworkStatus";

function RootNavigator() {
  const { setToken, setUser, logoutUser } = useContext(AuthContext);

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
      }
    };

    checkAuth();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <NetworkStatus />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
