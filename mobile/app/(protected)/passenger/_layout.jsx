import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "react-native";
import { PassengerProvider } from "../../../contexts/PassengerContext";

export default function PassengerLayout() {

    return <>
        <PassengerProvider>
            <Stack screenOptions={{ headerShown: false }} />
        </PassengerProvider>
    </>;
}