// Node runs this file (Expo CLI / EAS), not the app (eslint.config.js knows: Node globals).
// App config per build: app.json has everything fixed (permissions, plugins, splash, ...); this
// file sets what changes between builds, from env values. Expo runs it for `expo start` and for
// every EAS build (the profile's env from eas.json + its EAS environment variables).
//
//   APP_VARIANT          development | preview | production (eas.json sets it per profile;
//                        defaults to development). Each variant gets its own app id, name and scheme,
//                        so all three can be installed on one phone.
//   APP_ID               base Android package / iOS bundle id (default com.todagoo.app).
//                        preview adds ".preview", development ".dev". Can't change after store release.
//   APP_VERSION          the version people see (default: app.json "version"); build numbers
//                        are counted by EAS (eas.json "appVersionSource": "remote").
//   EAS_PROJECT_ID       from `eas init` (expo.dev project), needed for EAS builds and push tokens.
//   EXPO_OWNER           expo.dev account / organization that owns the project (optional).
//   EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WS_URL, EXPO_PUBLIC_ORS_API_KEY: what the app connects to,
//                        read by constants/config.js. Local `expo start`: .env. Release builds
//                        (EAS preview / production): .env.production (git-ignored, uploaded via
//                        .easignore), overridden by the profile's EAS environment variables if set.
//                        Checked here so a build can't ship pointing nowhere (see checkServerConfig).
const VARIANTS = {
    development: { suffix: ".dev", name: "TodaGoo Dev", scheme: "todagoo-dev" },
    preview: { suffix: ".preview", name: "TodaGoo Preview", scheme: "todagoo-preview" },
    production: { suffix: "", name: "TodaGoo", scheme: "todagoo" },
};

const env = (name, fallback = "") => (process.env[name] ?? fallback).trim();

// Release builds (preview, production) bundle in production mode, where Expo loads .env.production.
// Load it here too, so the checks below see the values that get built in. Values already set
// (EAS environment variables, the shell) win, as they do for the bundle.
function loadReleaseEnv(variant) {
    if (variant === "development") return;
    const { parseProjectEnv } = require("@expo/env");
    const { env: fileEnv } = parseProjectEnv(__dirname, { mode: "production", silent: true });
    for (const [key, value] of Object.entries(fileEnv)) {
        if (process.env[key] === undefined) process.env[key] = value;
    }
}

function variantName() {
    const value = env("APP_VARIANT", "development");
    if (!VARIANTS[value]) {
        throw new Error(`APP_VARIANT must be one of ${Object.keys(VARIANTS).join(", ")} (got "${value}").`);
    }
    return value;
}

// A wrong server URL is only noticed once the app is on a phone, so check it before building:
// - production: API https://, sockets wss:// (Android and iOS block plain http in release builds)
// - preview / development: any http(s) URL (a LAN backend while testing)
// EAS builds (EAS_BUILD=true) or STRICT_CONFIG=true fail on a problem; `expo start` only warns.
function checkServerConfig(variant) {
    const api = env("EXPO_PUBLIC_API_URL");
    const ws = env("EXPO_PUBLIC_WS_URL");
    const problems = [];

    if (!api) problems.push("EXPO_PUBLIC_API_URL is not set (e.g. https://api.example.com/api/).");
    else if (!/^https?:\/\/[^/]+/.test(api)) problems.push(`EXPO_PUBLIC_API_URL isn't an http(s) URL: "${api}".`);
    if (ws && !/^wss?:\/\/[^/]+/.test(ws)) problems.push(`EXPO_PUBLIC_WS_URL isn't a ws(s) URL: "${ws}".`);

    if (variant === "production") {
        if (api && !api.startsWith("https://")) problems.push("production: EXPO_PUBLIC_API_URL must use https://.");
        if (ws && !ws.startsWith("wss://")) problems.push("production: EXPO_PUBLIC_WS_URL must use wss://.");
        if (/localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|\.local\b/.test(`${api} ${ws}`)) {
            problems.push("production: the server URLs point at a local / LAN address.");
        }
    }
    // .env.production / .env.example ship with placeholder hosts: replace them first.
    // Preview builds bundle .env.production too (unless their EAS environment overrides it).
    if (variant !== "development" && /\.example\b|example\.(com|org|net)\b/.test(`${api} ${ws}`)) {
        problems.push(`${variant}: the server URLs are still the placeholders (…example…); set the real server in .env.production or the profile's EAS environment.`);
    }
    if (!env("EXPO_PUBLIC_ORS_API_KEY")) {
        // not fatal: routes are drawn as straight lines without it
        console.warn(`[app.config] ${variant}: EXPO_PUBLIC_ORS_API_KEY is not set; map routes won't follow roads.`);
    }

    if (!problems.length) return;
    const message = `[app.config] ${variant} build config:\n  - ${problems.join("\n  - ")}`;
    if (env("EAS_BUILD") === "true" || env("STRICT_CONFIG") === "true") throw new Error(message);
    console.warn(message);
}

module.exports = ({ config }) => {
    const variant = variantName();
    loadReleaseEnv(variant);
    const { suffix, name, scheme } = VARIANTS[variant];
    const appId = env("APP_ID", "com.todagoo.app") + suffix;
    const projectId = env("EAS_PROJECT_ID");
    const api = env("EXPO_PUBLIC_API_URL");

    checkServerConfig(variant);

    // plain http:// (a LAN backend) only for test builds; production must be https
    const cleartext = variant !== "production" && /^http:\/\//.test(api);
    const plugins = (config.plugins ?? []).filter(
        (p) => (Array.isArray(p) ? p[0] : p) !== "expo-build-properties"
    );
    plugins.push(["expo-build-properties", { android: { usesCleartextTraffic: cleartext } }]);

    return {
        ...config,
        name,
        slug: "todagoo",
        scheme,
        version: env("APP_VERSION", config.version),
        ...(env("EXPO_OWNER") && { owner: env("EXPO_OWNER") }),
        ios: { ...config.ios, bundleIdentifier: appId },
        android: { ...config.android, package: appId },
        plugins,
        extra: {
            ...config.extra,
            appVariant: variant,
            ...(projectId && { eas: { projectId } }),
        },
    };
};
