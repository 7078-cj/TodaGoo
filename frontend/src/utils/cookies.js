// [SEC-H7] One lifetime for all auth cookies, matching the backend REFRESH_TOKEN_LIFETIME
// (1 day). Before this, cookies outlived the tokens (6-7 days).
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24;

// [SEC-H7] Secure (HTTPS only, skipped on plain-http localhost) + SameSite=Strict
// so the tokens are never sent cross-site. Edit here to change every auth cookie.
function cookieAttributes() {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    return `; path=/; SameSite=Strict${secure}`;
}

export const Cookie = {
    get(name) {
        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1] || null;
    },

    set(name, value, seconds) {
        document.cookie = `${name}=${value}; max-age=${seconds}${cookieAttributes()}`;
    },

    delete(name) {
        document.cookie = `${name}=; max-age=0${cookieAttributes()}`;
    }
};

export function getUserFromCookie() {
    try {
        const raw = Cookie.get("user");
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}