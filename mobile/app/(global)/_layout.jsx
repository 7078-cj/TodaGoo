import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text } from "react-native";

export default function GlobalLayout() {

    return <Stack  screenOptions={{ headerShown: false }} />;
}