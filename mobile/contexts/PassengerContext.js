import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useEffect, useState } from "react";
import passengerListener from "../listeners/passengerListener";
import { store } from "expo-router/build/global-state/router-store";
import {router } from "expo-router";

const PassengerContext = createContext(null);

export default PassengerContext;

export function PassengerProvider({ children }) {
    const [userId, setUserId] = useState(null);
    const [pendingBooking, setPendingBooking] = useState(null);
    
    useEffect(() => {
        (async () => {
            const stored = await AsyncStorage.getItem("user");
            if (stored) {
                const user = JSON.parse(stored);
                setUserId(user.user_id);
            }
        })();
    }, []);

    useEffect(()=>{
            if (pendingBooking){
                router.push("/(protected)/passenger/en_route")
            }
        },[pendingBooking])
    
    
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