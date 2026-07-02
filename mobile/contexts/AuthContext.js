import { loginRequest, updateToken } from "@/api/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);

export default AuthContext;

export function AuthProvider({ children }) {
    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);
    const [authHydrated, setAuthHydrated] = useState(false);

    useEffect(() => {
        const loadAuthData = async () => {
            try {
                const storedToken = await AsyncStorage.getItem("token");
                const storedUser = await AsyncStorage.getItem("user");

                if (storedToken) setToken(JSON.parse(storedToken));
                if (storedUser) setUser(JSON.parse(storedUser));
            } catch (err) {
                console.error("Failed to load auth data:", err);
                await AsyncStorage.multiRemove(["token", "user"]).catch(() => {});
            } finally {
                setAuthHydrated(true);
            }
        };

        loadAuthData();
    }, []);

    const loginUser = async (email, password) => {
        let data;
        try {
            data = await loginRequest(email, password);
        } catch (err) {
            const message =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                (err?.request ? "Network error. Please check your connection." : "Something went wrong. Please try again.");
            console.error("Login request failed:", err);
            return { success: false, error: message };
        }

        if (!data?.access) {
            const message = data?.detail || data?.message || "Invalid email or password.";
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
            await AsyncStorage.setItem("token", JSON.stringify(data));
            await AsyncStorage.setItem("user", JSON.stringify(decodedUser));
        } catch (err) {
            console.error("Failed to persist auth data:", err);
        }

        return { success: true, user: decodedUser };
    };

    const logoutUser = async () => {
        setToken(null);
        setUser(null);
        try {
            await AsyncStorage.multiRemove(["token", "user"]);
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