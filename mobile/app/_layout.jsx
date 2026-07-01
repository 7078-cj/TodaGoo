import { Stack } from "expo-router";
import "../global.css";
import { AuthProvider } from "../contexts/AuthContext"
import { Href, router } from "expo-router";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";


export default function RootLayout() {

  useEffect(() => {
    const checkAuth = async () => {
      const user = await AsyncStorage.getItem("user");
      const parsedUser = user ? JSON.parse(user) : null;
      if (parsedUser) {
        
        parsedUser.role == "passenger" ? router.push("(protected)/passenger/home") : router.push("(protected)/driver/home");
      }else{
        router.push("/(global)/login");
      }
    };

    checkAuth();
  }, []);

  return (
    <AuthProvider>
      <Stack />
    </AuthProvider>
    )
}
