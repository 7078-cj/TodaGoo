import { Stack } from "expo-router";
import "../global.css";
import { AuthProvider } from "../contexts/AuthContext"
import { useEffect } from "react";
import { updateToken } from "@/api/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default async function RootLayout() {
  const token = await AsyncStorage.getItem("token");
  const access = token ? JSON.parse(token).access : null;

  useEffect(() => {
      if (!access) return;
      const interval = setInterval(() => {
          updateToken(setToken, setUser, logoutUser);
      }, 600000);
      return () => clearInterval(interval);
  }, [access]);

  return (
    <AuthProvider>
      <Stack />
    </AuthProvider>
    )
}
