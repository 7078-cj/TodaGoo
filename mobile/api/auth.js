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
        logoutUser();
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
