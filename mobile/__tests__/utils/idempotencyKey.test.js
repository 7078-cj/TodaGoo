import newIdempotencyKey from "../../utils/idempotencyKey";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newIdempotencyKey", () => {
    it("returns a UUID v4", () => {
        expect(newIdempotencyKey()).toMatch(UUID_V4);
    });

    it("works without crypto.randomUUID (the fallback)", () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
        Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
        try {
            const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
            keys.forEach((key) => expect(key).toMatch(UUID_V4));
            expect(keys.size).toBe(50);
        } finally {
            if (original) Object.defineProperty(globalThis, "crypto", original);
            else delete globalThis.crypto;
        }
    });
});
