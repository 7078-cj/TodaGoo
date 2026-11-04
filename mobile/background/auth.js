import { jwtDecode } from "jwt-decode";
import { getStoredToken, setStoredToken } from "../utils/tokenStorage";
import { postRequest } from "../utils/requests";

const EXPIRY_MARGIN_S = 60;

// Background tasks run without AuthContext (which refreshes the token every 10 min while open),
// so after a long time closed the saved access token has usually expired. Refresh it first.
async function refresh(refreshToken) {
    const res = await postRequest("user/token/refresh/", { refresh: refreshToken }, false);
    if (!res.success) return null;

    const tokens = { access: res.data.access, refresh: res.data.refresh ?? refreshToken };
    await setStoredToken(JSON.stringify(tokens));
    return tokens.access;
}

// A valid access token, or null when logged out / the refresh was rejected
export async function getAccessToken() {
    const stored = await getStoredToken();
    if (!stored) return null;

    try {
        const { access, refresh: refreshToken } = JSON.parse(stored);
        const { exp } = jwtDecode(access);
        if (exp && exp - EXPIRY_MARGIN_S > Date.now() / 1000) return access;
        return refreshToken ? await refresh(refreshToken) : null;
    } catch {
        return null;
    }
}
