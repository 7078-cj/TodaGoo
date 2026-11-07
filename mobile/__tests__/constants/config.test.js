import { originOf, withTrailingSlash, wsUrlFor } from "../../constants/config";

const ORIGINAL = { ...process.env };

// constants/config.js reads the EXPO_PUBLIC_* values when it's imported
function loadConfig(vars) {
    for (const key of ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_WS_URL", "EXPO_PUBLIC_ORS_API_KEY"]) delete process.env[key];
    Object.assign(process.env, vars);
    let mod;
    jest.isolateModules(() => {
        mod = require("../../constants/config");
    });
    return mod.default;
}

afterEach(() => {
    process.env = { ...ORIGINAL };
});

describe("URL helpers", () => {
    it.each([
        ["http://x:8000/api", "http://x:8000/api/"],
        ["http://x:8000/api/", "http://x:8000/api/"],
        ["  https://a.b/api  ", "https://a.b/api/"],
        ["", ""],
        [undefined, ""],
    ])("withTrailingSlash(%p) -> %p", (input, out) => {
        expect(withTrailingSlash(input)).toBe(out);
    });

    it.each([
        ["http://x:8000/api/", "http://x:8000"],
        ["https://a.b/api", "https://a.b"],
        ["https://a.b/", "https://a.b"],
        ["", ""],
    ])("originOf(%p) -> %p", (input, out) => {
        expect(originOf(input)).toBe(out);
    });

    it.each([
        ["http://192.168.1.10:8000/api/", "ws://192.168.1.10:8000/"],
        ["https://api.todagoo.example/api/", "wss://api.todagoo.example/"],
        ["", ""],
    ])("wsUrlFor(%p) -> %p", (input, out) => {
        expect(wsUrlFor(input)).toBe(out);
    });
});

describe("config", () => {
    it("normalizes the URLs so `${url}path` always works", () => {
        const config = loadConfig({
            EXPO_PUBLIC_API_URL: "https://api.todagoo.example/api",
            EXPO_PUBLIC_WS_URL: "wss://api.todagoo.example",
            EXPO_PUBLIC_ORS_API_KEY: " key123 ",
        });
        expect(config).toEqual({
            apiUrl: "https://api.todagoo.example/api/",
            apiOrigin: "https://api.todagoo.example",
            wsUrl: "wss://api.todagoo.example/",
            orsApiKey: "key123",
        });
    });

    it("the socket URL defaults to the API's host", () => {
        const config = loadConfig({ EXPO_PUBLIC_API_URL: "https://api.todagoo.example/api/" });
        expect(config.wsUrl).toBe("wss://api.todagoo.example/");
        expect(config.orsApiKey).toBe("");
    });

    it("nothing set: empty values, no crash", () => {
        const config = loadConfig({});
        expect(config).toEqual({ apiUrl: "", apiOrigin: "", wsUrl: "", orsApiKey: "" });
    });

    it("requests, media and sockets all build on it", () => {
        loadConfig({ EXPO_PUBLIC_API_URL: "https://api.todagoo.example/api" });
        let person;
        jest.isolateModules(() => {
            person = require("../../utils/person");
        });
        expect(person.mediaUrl("/media/a.png")).toBe("https://api.todagoo.example/media/a.png");
    });
});
