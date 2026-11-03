import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useEffect, useRef, useState } from "react";
import passengerListener from "../listeners/passengerListener";
import {router } from "expo-router";

const PassengerContext = createContext(null);

export default PassengerContext;

export function PassengerProvider({ children }) {
    const [userId, setUserId] = useState(null);
    const [pendingBooking, setPendingBooking] = useState(null);
    const lastScreenRef = useRef(null);
    
    useEffect(() => {
        (async () => {
            const stored = await AsyncStorage.getItem("user");
            if (stored) {
                const user = JSON.parse(stored);
                setUserId(user.user_id);
            }
        })();
    }, []);

    useEffect(() => {
        if (!pendingBooking) return;

        const screen = pendingBooking.status === "completed" ? "complete" : "en_route";
        const key = `${pendingBooking.id}:${screen}`;
        if (lastScreenRef.current === key) return;
        lastScreenRef.current = key;

        router.push(`/(protected)/passenger/${screen}`);
    }, [pendingBooking]);
    
    
    const ws = passengerListener(userId, () => console.log("refresh"), setPendingBooking);

    return (
        <PassengerContext.Provider value={{ 
            pendingBooking,
            setPendingBooking
        }}>
            {children}
        </PassengerContext.Provider>
    );
}