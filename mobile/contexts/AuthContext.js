import { loginRequest } from "@/api/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useEffect, useState } from "react";

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
        } finally {
            setAuthHydrated(true);
        }
        };

        loadAuthData();
    }, []);

    const loginUser = async (
        email,
        password,
    ) => {
        try {
        const data = await loginRequest(email, password);

        if (data.token && data.user) {
            setToken(data.token);
            setUser(data.user);

            await AsyncStorage.setItem("token", JSON.stringify(data.token));
            await AsyncStorage.setItem("user", JSON.stringify(data.user));
        }else{
            return data
        }
        } catch (err) {
        return err;
        }
    };

    const logoutUser = async () => {
        setToken(null);
        setUser(null);
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("user");
    };

    return (
        <AuthContext.Provider value={{ token, user, authHydrated, loginUser, logoutUser }}>
        {children}
        </AuthContext.Provider>
    );
}