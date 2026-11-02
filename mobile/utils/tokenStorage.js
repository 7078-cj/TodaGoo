import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// [SEC-L4] Auth tokens live in the OS keychain/keystore (expo-secure-store) instead of
// plain AsyncStorage. Values are the same JSON string as before ({access, refresh}),
// so callers keep doing JSON.parse(await getStoredToken()).
// SecureStore isn't available on web, so web falls back to AsyncStorage.
const TOKEN_KEY = "token";
const useSecureStore = Platform.OS !== "web";

export async function getStoredToken() {
    if (!useSecureStore) return AsyncStorage.getItem(TOKEN_KEY);

    const value = await SecureStore.getItemAsync(TOKEN_KEY);
    if (value) return value;

    // One-time move of a token saved by an older app version
    const legacy = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacy) {
        await SecureStore.setItemAsync(TOKEN_KEY, legacy);
        await AsyncStorage.removeItem(TOKEN_KEY);
    }
    return legacy;
}

export async function setStoredToken(value) {
    if (!useSecureStore) return AsyncStorage.setItem(TOKEN_KEY, value);
    await SecureStore.setItemAsync(TOKEN_KEY, value);
}

export async function removeStoredToken() {
    await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
    if (useSecureStore) await SecureStore.deleteItemAsync(TOKEN_KEY);
}
