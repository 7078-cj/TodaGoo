import { Stack, router } from "expo-router";
import "../global.css";
import AuthContext from '@/contexts/AuthContext';
import { AuthProvider } from "@/contexts/AuthContext";
import { useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateToken } from "@/api/auth";

function RootNavigator() {
  const { setToken, setUser, logoutUser } = useContext(AuthContext);

  useEffect(() => {
    const checkAuth = async () => {

      const user = await AsyncStorage.getItem("user");
      const parsedUser = user ? JSON.parse(user) : null;

      if (!user) {
          router.replace("/(global)/login");
          return;
      }

      await updateToken(setToken, setUser, logoutUser);


      if (parsedUser) {
        if (parsedUser.role === "passenger") {
          router.replace("/(protected)/passenger/home");
        } else {
          router.replace("/(protected)/driver/home");
        }
      } else {
        router.replace("/(global)/login");
      }
    };

    checkAuth();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}