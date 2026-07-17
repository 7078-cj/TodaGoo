
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import driverListener from "../listeners/driverListener"

const DriverContext = createContext(null);

export default DriverContext;

export async function DriverProvider({ children }) {
    const user = await AsyncStorage.getItem("user");

    driverListener(user.id, () => console.log("refresh"))
    return (
        <DriverContext.Provider value={{ }}>
            {children}
        </DriverContext.Provider>
    );
}
