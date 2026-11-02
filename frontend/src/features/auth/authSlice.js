import { createSlice } from "@reduxjs/toolkit";
import { Cookie, AUTH_COOKIE_MAX_AGE } from "../../utils/cookies";

const initialState = {
    access: Cookie.get("access") || null,
    refresh: Cookie.get("refresh") || null,
    user: Cookie.get("user")
        ? JSON.parse(Cookie.get("user"))
        : null,
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setAuth(state, action) {
            const { tokens, user } = action.payload;

            state.access = tokens.access;
            state.refresh = tokens.refresh;
            state.user = user;

            // [SEC-H7] lifetimes aligned with the token lifetime
            Cookie.set("access", tokens.access, AUTH_COOKIE_MAX_AGE);
            Cookie.set("refresh", tokens.refresh, AUTH_COOKIE_MAX_AGE);
            Cookie.set("user", JSON.stringify(user), AUTH_COOKIE_MAX_AGE);
        },

        logout(state) {
            state.access = null;
            state.refresh = null;
            state.user = null;

            Cookie.delete("access");
            Cookie.delete("refresh");
            Cookie.delete("user");
        },
    },
});

export const { setAuth, logout } = authSlice.actions;
export default authSlice.reducer;