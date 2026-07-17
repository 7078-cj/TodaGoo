
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import passengerListener from "../listeners/passengerListener"

const PassengerContext = createContext(null);

export default PassengerContext;

export async function PassengerProvider({ children }) {
    const user = await AsyncStorage.getItem("user");

    passengerListener(user.id, () => console.log('refresh'))
    return (
        <PassengerContext.Provider value={{ }}>
            {children}
        </PassengerContext.Provider>
    );
}