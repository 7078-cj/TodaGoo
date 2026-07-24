import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useEffect, useState } from "react";
import useDriverListener from "../listeners/driverListener";

const DriverContext = createContext(null);

export default DriverContext;

export function DriverProvider({ children }) {
    const [userId, setUserId] = useState(null);
    const [pendingBooking, setPendingBooking] = useState(null);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const stored = await AsyncStorage.getItem("user");

                if (!stored) return;

                const user = JSON.parse(stored);
                setUserId(user.user_id);
            } catch (err) {
                console.error("Failed to load user:", err);
            }
        };

        loadUser();
    }, []);


    const {
        acceptBooking,
        declineBooking,
        connected,
        connectionStatus,
    } = useDriverListener(
        userId,
        () => console.log("refresh"),
        setPendingBooking
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