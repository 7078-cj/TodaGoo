
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import driverListener from "../listeners/driverListener"

const DriverContext = createContext(null);

export default DriverContext;

export function DriverProvider({ children }) {
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const stored = await AsyncStorage.getItem("user");
                if (stored) {
                    const user = JSON.parse(stored);
                    setUserId(user.user_id);
                }
            } catch (err) {
                console.error("Failed to load user:", err);
            }
        })();
    }, []);


    const ws = driverListener(userId, () => console.log("refresh"))
    return (
        <DriverContext.Provider value={{ }}>
            {children}
        </DriverContext.Provider>
    );
}
