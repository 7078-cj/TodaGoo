import { postRequest } from "../utils/requests";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";


export async function loginRequest(username, password) {
    const res = await postRequest('user/token/user', {username, password}, false)
    return res.data;
}

export const updateToken = async (setToken, setUser, logoutUser) => {
    const storedToken = await AsyncStorage.getItem("token");

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

    await AsyncStorage.setItem(
        "token",
        JSON.stringify(newToken)
    );

    await AsyncStorage.setItem(
        "user",
        JSON.stringify(user)
    );
};
