
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

const PassengerContext = createContext(null);

export default PassengerContext;

export function PassengerProvider({ children }) {


    return (
        <PassengerContext.Provider value={{ }}>
            {children}
        </PassengerContext.Provider>
    );
}