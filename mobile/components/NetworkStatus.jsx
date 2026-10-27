
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NetworkStatus() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
        const offline =
            state.isConnected === false ||
            state.isInternetReachable === false;

        setIsOffline(offline);
        });

        return unsubscribe;
    }, []);

    if (!isOffline) return null;

    return (
        <SafeAreaView
        edges={["top", "left", "right"]}
        className="absolute left-0 right-0 top-0 z-50"
        pointerEvents="none"
        >
        <View className="bg-red-600 px-4 py-3">
            <Text className="text-center font-semibold text-white">
            No internet connection. Check your network.
            </Text>
        </View>
        </SafeAreaView>
    );
}
