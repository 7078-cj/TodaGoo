// UUID v4 for Idempotency-Key headers.
// Doesn't use the `uuid` package: it needs the react-native-get-random-values native module,
// which isn't in every build ("Native module not found"). A key only has to be unique, not secret.
export default function newIdempotencyKey() {
    if (typeof globalThis.crypto?.randomUUID === "function") {
        return globalThis.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}
