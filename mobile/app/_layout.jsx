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
        
        parsedUser.role == "passenger" ? router.replace("(protected)/passenger/home") : router.replace("(protected)/driver/home");
      }else{
        router.replace("/(global)/login");
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
