import { postRequest } from "../utils/requests";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";


export async function loginRequest(email, password) {
    const res = await postRequest('user/token/user', {email, password}, false)
    return res.data;
}

export const updateToken = async (setToken, setUser, logoutUser) => {
    const token = await AsyncStorage.getItem("token");

    if (!token) return;

    const response = await postRequest('user/token/refresh', {refresh: JSON.parse(token).refresh}, false);

    const data = await response.json();

    if (response.ok) {

        setToken(data);
        setUser(jwtDecode(data.access));

        try {
            await AsyncStorage.setItem("token", JSON.stringify(data));
            await AsyncStorage.setItem("user", JSON.stringify(user));
        } catch (err) {
            console.error("Failed to persist auth data:", err);
        }
    }
    else{
        logoutUser();
    }
};
