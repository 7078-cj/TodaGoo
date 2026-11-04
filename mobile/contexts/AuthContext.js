import { loginRequest, updateToken } from "@/api/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStoredToken, setStoredToken, removeStoredToken } from "../utils/tokenStorage";
import React, { createContext, ReactNode, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { stopBackgroundWork } from "../background";

const AuthContext = createContext(null);

export default AuthContext;

export function AuthProvider({ children }) {
    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);
    const [authHydrated, setAuthHydrated] = useState(false);

    useEffect(() => {
        const loadAuthData = async () => {
            try {
                const storedToken = await getStoredToken(); // [SEC-L4] secure storage
                const storedUser = await AsyncStorage.getItem("user");

                if (storedToken) setToken(JSON.parse(storedToken));
                if (storedUser) setUser(JSON.parse(storedUser));
            } catch (err) {
                console.error("Failed to load auth data:", err);
                await removeStoredToken().catch(() => {});
                await AsyncStorage.removeItem("user").catch(() => {});
            } finally {
                setAuthHydrated(true);
            }
        };

        loadAuthData();
    }, []);

    const loginUser = async (username, password) => {
        let data;
        try {
            data = await loginRequest(username, password);
        } catch (err) {
            const message =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                (err?.request ? "Network error. Please check your connection." : "Something went wrong. Please try again.");
            console.error("Login request failed:", err);
            return { success: false, error: message };
        }

        if (!data?.access) {
            const message = data?.detail || data?.message || "Invalid username or password.";
            return { success: false, error: message };
        }

        let decodedUser;
        try {
            decodedUser = jwtDecode(data.access);
        } catch (err) {
            console.error("Failed to decode JWT:", err);
            return { success: false, error: "Received an invalid session token. Please try again." };
        }

        setToken(data);
        setUser(decodedUser);

        try {
            await setStoredToken(JSON.stringify(data)); // [SEC-L4]
            await AsyncStorage.setItem("user", JSON.stringify(decodedUser));
        } catch (err) {
            console.error("Failed to persist auth data:", err);
        }

        return { success: true, user: decodedUser };
    };

    const logoutUser = async () => {
        setToken(null);
        setUser(null);
        // no ride tracking / notification checks for the previous user
        stopBackgroundWork().catch(() => {});
        try {
            await removeStoredToken(); // [SEC-L4]
            await AsyncStorage.removeItem("user");
        } catch (err) {
            console.error("Failed to clear auth data:", err);
        }
    };

    useEffect(() => {
        if (!token?.access) return;
        const interval = setInterval(() => {
            updateToken(setToken, setUser, logoutUser);
        }, 600000);
        return () => clearInterval(interval);
    }, [token]);

    return (
        <AuthContext.Provider value={{ token, setToken, user, setUser, authHydrated, loginUser, logoutUser }}>
            {children}
        </AuthContext.Provider>
    );
}