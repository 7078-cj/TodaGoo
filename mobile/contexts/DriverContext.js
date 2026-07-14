
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

const DriverContext = createContext(null);

export default DriverContext;

export function DriverProvider({ children }) {


    return (
        <DriverContext.Provider value={{ }}>
            {children}
        </DriverContext.Provider>
    );
}