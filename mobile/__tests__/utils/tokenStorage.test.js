import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getStoredToken, removeStoredToken, setStoredToken } from "../../utils/tokenStorage";

const TOKEN = JSON.stringify({ access: "a", refresh: "r" });

beforeEach(async () => {
    await AsyncStorage.clear();
    SecureStore.__store.clear();
    jest.clearAllMocks();
});

describe("tokenStorage (native: secure store)", () => {
    it("saves and reads the token from the secure store, not AsyncStorage", async () => {
        await setStoredToken(TOKEN);
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith("token", TOKEN);
        expect(await AsyncStorage.getItem("token")).toBeNull();
        expect(await getStoredToken()).toBe(TOKEN);
    });

    it("moves a token saved by an older version from AsyncStorage to the secure store", async () => {
        await AsyncStorage.setItem("token", TOKEN);
        expect(await getStoredToken()).toBe(TOKEN);
        expect(SecureStore.__store.get("token")).toBe(TOKEN);
        expect(await AsyncStorage.getItem("token")).toBeNull();
    });

    it("returns null when there's no token anywhere", async () => {
        expect(await getStoredToken()).toBeNull();
    });

    it("removes the token from both stores", async () => {
        await setStoredToken(TOKEN);
        await AsyncStorage.setItem("token", TOKEN);
        await removeStoredToken();
        expect(await getStoredToken()).toBeNull();
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("token");
    });
});
