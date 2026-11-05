// Runs before every mobile test file (package.json → jest.setupFiles).
// Native modules have no implementation under Jest: replace them with in-memory fakes.

// Same shape as mobile/.env; set here so tests never use a real server address from a local .env
process.env.EXPO_PUBLIC_API_URL = "http://localhost:8000/api/";
process.env.EXPO_PUBLIC_WS_URL = "ws://localhost:8000/";

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-secure-store", () => {
    const store = new Map();
    return {
        __store: store,
        getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
        setItemAsync: jest.fn(async (key, value) => {
            store.set(key, value);
        }),
        deleteItemAsync: jest.fn(async (key) => {
            store.delete(key);
        }),
    };
});

jest.mock("expo-file-system", () => ({
    File: class File {
        constructor(uri) {
            this.uri = uri;
            this.name = uri.split("/").pop();
        }
    },
}));

jest.mock("expo-router", () => ({
    router: { push: jest.fn(), dismissTo: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
