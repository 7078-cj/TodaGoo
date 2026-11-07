// Where the app talks to: read once from the EXPO_PUBLIC_* env values, which are baked into the
// bundle when it's built (local: mobile/.env; EAS builds: the profile's EAS environment, see
// eas.json and the "Building the app" section of mobile/README.md).
//
//   EXPO_PUBLIC_API_URL      REST API, e.g. https://api.todagoo.example/api/
//   EXPO_PUBLIC_WS_URL       WebSockets, e.g. wss://api.todagoo.example/
//   EXPO_PUBLIC_ORS_API_KEY  OpenRouteService key for route drawing (optional: straight lines without it)
//
// Every place in the app reads these from here, so a missing trailing "/" can't break URLs.

// "http://x:8000/api" -> "http://x:8000/api/"; "" stays "" (no server configured)
export const withTrailingSlash = (url) => {
    const value = String(url ?? "").trim();
    if (!value) return "";
    return value.endsWith("/") ? value : `${value}/`;
};

// "http://x:8000/api/" -> "http://x:8000" (media files are served from the origin, not /api)
export const originOf = (apiUrl) => withTrailingSlash(apiUrl).replace(/\/api\/$/, "/").replace(/\/$/, "");

// The WebSocket server for an API URL when EXPO_PUBLIC_WS_URL isn't set:
// http(s)://host/api/ -> ws(s)://host/
export const wsUrlFor = (apiUrl) => {
    const origin = originOf(apiUrl);
    if (!origin) return "";
    return withTrailingSlash(origin.replace(/^http/, "ws"));
};

const API_URL = withTrailingSlash(process.env.EXPO_PUBLIC_API_URL);

const config = {
    // REST calls: `${apiUrl}booking/` (always ends with "/")
    apiUrl: API_URL,
    // media files (/media/...): the API's origin
    apiOrigin: originOf(API_URL),
    // sockets: `${wsUrl}ws/driver/12` (always ends with "/"); defaults to the API's host
    wsUrl: withTrailingSlash(process.env.EXPO_PUBLIC_WS_URL) || wsUrlFor(API_URL),
    orsApiKey: (process.env.EXPO_PUBLIC_ORS_API_KEY ?? "").trim(),
};

if (!config.apiUrl && process.env.NODE_ENV !== "test") {
    console.warn("[config] EXPO_PUBLIC_API_URL is not set: the app can't reach the server.");
}

export default config;
