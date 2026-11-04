import { postRequest } from "../utils/requests";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { getStoredToken, setStoredToken } from "../utils/tokenStorage";


export async function loginRequest(username, password) {
    const res = await postRequest('user/token/user', {username, password}, false)
    return res.data;
}

export const updateToken = async (setToken, setUser, logoutUser) => {
    const storedToken = await getStoredToken(); // [SEC-L4] secure storage

    if (!storedToken) return;

    const currentToken = JSON.parse(storedToken);

    const response = await postRequest(
        "user/token/refresh/",
        {
            refresh: currentToken.refresh,
        },
        false
    );


    if (!response.success) {
        // only a rejected refresh token ends the session; offline / timeout / server errors keep the
        // user logged in (the next refresh tries again)
        if (response.kind === "auth" || response.kind === "validation") logoutUser();
        return;
    }

    const newToken = {
        access: response.data.access,
        refresh: response.data.refresh
    };

    setToken(newToken);

    const user = jwtDecode(newToken.access);
    setUser(user);

    await setStoredToken(JSON.stringify(newToken)); // [SEC-L4]

    await AsyncStorage.setItem(
        "user",
        JSON.stringify(user)
    );
};

// Store a new token pair the same way login / refresh do
export async function saveTokens(tokens, setToken, setUser) {
    const user = jwtDecode(tokens.access);
    setToken(tokens);
    setUser(user);
    await setStoredToken(JSON.stringify(tokens)); // [SEC-L4]
    await AsyncStorage.setItem("user", JSON.stringify(user));
}

// body: the verification fields (see constants/passwordChange.js) + new_password.
// Other sessions are signed out; the response carries a fresh token pair for this device.
export const changePassword = async (body) => {
    return await postRequest("user/change-password/", body, true);
};
