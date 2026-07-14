import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "react-native";
import { DriverProvider } from "../../../contexts/DriverContext";

export default function DriverLayout() {

    return <>
        <DriverProvider>
            <Stack screenOptions={{ headerShown: false }} />
        </DriverProvider>
    </>;
}