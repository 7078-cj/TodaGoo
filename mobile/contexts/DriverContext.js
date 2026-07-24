import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useEffect, useState } from "react";
import driverListener from "../listeners/driverListener";

const DriverContext = createContext(null);

export default DriverContext;

export function DriverProvider({ children }) {
    const [userId, setUserId] = useState(null);
    const [pendingBooking, setPendingBooking] = useState(null);

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

    const { acceptBooking, declineBooking, connected, connectionStatus } = driverListener(
        userId,
        () => console.log("refresh"),
        { setPendingBooking }
    );

    return (
        <DriverContext.Provider
            value={{
                pendingBooking,
                acceptBooking,
                declineBooking,
                connected,
                connectionStatus,
            }}
        >
            {children}
        </DriverContext.Provider>
    );
}