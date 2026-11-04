import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useEffect, useRef, useState } from "react";
import useDriverListener from "../listeners/driverListener";
import { useNavigationContainerRef } from "expo-router";
import { goTo } from "../utils/navigation";
import { setActiveBooking } from "../utils/activeBookingStore";
import { startDriverLocationUpdates, stopDriverLocationUpdates } from "../background";

const TRACKED_STATUSES = ["accepted", "in_progress"];

const DriverContext = createContext(null);

export default DriverContext;

export function DriverProvider({ children }) {
    const [userId, setUserId] = useState(null);
    const [pendingBooking, setPendingBooking] = useState(null);
    const [acceptedBooking, setAcceptedBooking] = useState(null);
    const lastScreenRef = useRef(null);
    const navigationRef = useNavigationContainerRef();
    

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

    useEffect(() => {
        if (!acceptedBooking) return;

        const screen = acceptedBooking.status === "completed" ? "complete" : "en_route";
        const key = `${acceptedBooking.id}:${screen}`;
        if (lastScreenRef.current === key) return;
        lastScreenRef.current = key;

        // goTo: from History / Profile a push would stack a second driver layout
        goTo(`/(protected)/driver/${screen}`, navigationRef.getRootState());
    }, [acceptedBooking, navigationRef]);

    // the bottom nav's Booking tab is only enabled while a ride is active
    useEffect(() => {
        setActiveBooking(acceptedBooking);
    }, [acceptedBooking]);

    // keep sending the driver's location while the app is minimized / closed, for as long as the
    // ride is active. Null (still loading after a restart) changes nothing; the ride ending stops it.
    useEffect(() => {
        if (!acceptedBooking) return;
        if (TRACKED_STATUSES.includes(acceptedBooking.status)) startDriverLocationUpdates(acceptedBooking.id);
        else stopDriverLocationUpdates();
    }, [acceptedBooking?.id, acceptedBooking?.status]); // eslint-disable-line react-hooks/exhaustive-deps

    // logging out / leaving the driver screens: no active ride for whoever uses the app next
    useEffect(() => () => setActiveBooking(null), []);
    
        


    const {
        acceptBooking,
        declineBooking,
        connected,
        connectionStatus,
    } = useDriverListener(
        userId,
        () => console.log("refresh"),
        setPendingBooking,
        setAcceptedBooking
    );

    return (
        <DriverContext.Provider
            value={{
                pendingBooking,
                acceptBooking,
                declineBooking,
                connected,
                connectionStatus,
                acceptedBooking,
                setAcceptedBooking
            }}
        >
            {children}
        </DriverContext.Provider>
    );
}