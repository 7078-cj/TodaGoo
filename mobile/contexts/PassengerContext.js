import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useEffect, useRef, useState } from "react";
import passengerListener from "../listeners/passengerListener";
import { useNavigationContainerRef } from "expo-router";
import { goTo } from "../utils/navigation";
import { setActiveBooking } from "../utils/activeBookingStore";

const PassengerContext = createContext(null);

export default PassengerContext;

export function PassengerProvider({ children }) {
    const [userId, setUserId] = useState(null);
    const [pendingBooking, setPendingBooking] = useState(null);
    // { booking_id, message } when the server dropped a new booking (no driver found); Book a Ride shows it
    const [bookingUnavailable, setBookingUnavailable] = useState(null);
    const lastScreenRef = useRef(null);
    const navigationRef = useNavigationContainerRef();
    
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

        // goTo: from History / Profile a push would stack a second passenger layout
        goTo(`/(protected)/passenger/${screen}`, navigationRef.getRootState());
    }, [pendingBooking, navigationRef]);

    // while a ride is active the bottom nav's Booking tab opens the trip instead of a new booking
    useEffect(() => {
        setActiveBooking(pendingBooking);
    }, [pendingBooking]);

    // logging out / leaving the passenger screens: no active ride for whoever uses the app next
    useEffect(() => () => setActiveBooking(null), []);
    
    
    const ws = passengerListener(userId, () => console.log("refresh"), setPendingBooking, setBookingUnavailable);

    return (
        <PassengerContext.Provider value={{ 
            pendingBooking,
            setPendingBooking,
            bookingUnavailable,
            setBookingUnavailable,
        }}>
            {children}
        </PassengerContext.Provider>
    );
}