import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "react-native";
import BottomNav from "../../components/layouts/BottomNav";

export default function ProtectedLayout() {
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await AsyncStorage.getItem("user");
                const parsedUser = user ? JSON.parse(user) : null;
                if (!parsedUser) {
                    router.replace("/(global)/login");
                }
            } finally {
                setChecking(false);
            }
        };

        checkAuth(); 
    }, []);

    if (checking) {
        return (<>
            <Text>Checking authentication...</Text>
        </>); 
    }

    return <>
        <Stack screenOptions={{ headerShown: false }} />
        <BottomNav/>
    </>;
}