import { ERROR_MESSAGES } from "../../constants/errors";
import { setStoredToken, removeStoredToken } from "../../utils/tokenStorage";
import {
    buildFormData,
    deleteRequest,
    getRequest,
    patchRequest,
    postRequest,
    putRequest,
} from "../../utils/requests";

// A fetch Response stand-in: status + JSON body (or a body that isn't JSON)
const response = (status, body, { json = true } = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    json: json ? async () => body : async () => {
        throw new SyntaxError("Unexpected token <");
    },
});

let fetchMock;
beforeEach(async () => {
    fetchMock = jest.fn(async () => response(200, { ok: true }));
    global.fetch = fetchMock;
    await removeStoredToken();
});

const lastCall = () => {
    const [url, options] = fetchMock.mock.calls.at(-1);
    return { url, options };
};

describe("getRequest", () => {
    it("adds query params, skipping null / undefined", async () => {
        const res = await getRequest("/rides/", { page: 2, status: "done", empty: null, missing: undefined });
        expect(res).toEqual({ success: true, status: 200, data: { ok: true } });
        expect(lastCall().url).toMatch(/\/rides\/\?page=2&status=done$/);
        expect(lastCall().options.method).toBe("GET");
    });

    it("sends no Authorization header without isToken", async () => {
        await setStoredToken(JSON.stringify({ access: "abc" }));
        await getRequest("/me/");
        expect(lastCall().options.headers.Authorization).toBeUndefined();
    });

    it("sends the stored access token with isToken", async () => {
        await setStoredToken(JSON.stringify({ access: "abc", refresh: "r" }));
        await getRequest("/me/", {}, true);
        expect(lastCall().options.headers.Authorization).toBe("Bearer abc");
    });

    it("sends no Authorization header when nothing is stored", async () => {
        await getRequest("/me/", {}, true);
        expect(lastCall().options.headers.Authorization).toBeUndefined();
    });
});

describe("postRequest / putRequest / patchRequest / deleteRequest", () => {
    it("POSTs JSON with the idempotency key", async () => {
        await postRequest("/book/", { a: 1 }, false, "key-1");
        const { options } = lastCall();
        expect(options.method).toBe("POST");
        expect(options.body).toBe(JSON.stringify({ a: 1 }));
        expect(options.headers["Content-Type"]).toBe("application/json");
        expect(options.headers["Idempotency-Key"]).toBe("key-1");
        expect(options.credentials).toBe("include");
    });

    it("sends multipart (no JSON content type) when the data has a picked file", async () => {
        await patchRequest("/profile/", { name: "x", photo: { uri: "file:///p.jpg" } });
        const { options } = lastCall();
        expect(options.method).toBe("PATCH");
        expect(options.body).toBeInstanceOf(FormData);
        expect(options.headers["Content-Type"]).toBeUndefined();
    });

    it("PUTs and DELETEs with the right method", async () => {
        await putRequest("/x/", { a: 1 });
        expect(lastCall().options.method).toBe("PUT");
        await deleteRequest("/x/1/", false, "key-2");
        expect(lastCall().options.method).toBe("DELETE");
        expect(lastCall().options.headers["Idempotency-Key"]).toBe("key-2");
    });

    it("treats 204 as success without reading a body", async () => {
        fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: jest.fn() });
        expect(await deleteRequest("/x/1/")).toEqual({ success: true, status: 204 });
    });
});

describe("error results", () => {
    it.each([
        [500, {}, "server", ERROR_MESSAGES.server],
        [503, { detail: "db down" }, "server", ERROR_MESSAGES.server],
        [401, { detail: "Token expired", code: "token_not_valid" }, "auth", ERROR_MESSAGES.auth],
        [401, {}, "auth", ERROR_MESSAGES.auth],
        [401, { detail: "No active account found." }, "auth", "No active account found."],
        [403, {}, "forbidden", ERROR_MESSAGES.forbidden],
        [403, { detail: "Drivers only." }, "forbidden", "Drivers only."],
        [404, { detail: "Not found." }, "not_found", ERROR_MESSAGES.not_found],
        [404, { detail: "No such booking." }, "not_found", "No such booking."],
        [429, { detail: "Throttled." }, "throttled", ERROR_MESSAGES.throttled],
        [400, { username: ["Already taken."] }, "validation", "Already taken."],
        [409, { detail: "Already rated." }, "validation", "Already rated."],
        [418, {}, "http", "Request failed"],
    ])("status %p %p → kind %p", async (status, body, kind, error) => {
        fetchMock.mockResolvedValueOnce(response(status, body));
        const res = await postRequest("/x/", {});
        expect(res).toEqual({ success: false, status, kind, error, data: body });
    });

    it("handles an error page that isn't JSON", async () => {
        fetchMock.mockResolvedValueOnce(response(502, null, { json: false }));
        const res = await getRequest("/x/");
        expect(res).toMatchObject({ success: false, status: 502, kind: "server", data: {} });
    });

    it("uses the method's fallback message", async () => {
        fetchMock.mockResolvedValueOnce(response(418, {}));
        expect((await putRequest("/x/", {})).error).toBe("Update failed");
        fetchMock.mockResolvedValueOnce(response(418, {}));
        expect((await deleteRequest("/x/")).error).toBe("Delete failed");
    });

    it("reports a network failure", async () => {
        const log = jest.spyOn(console, "log").mockImplementation(() => {});
        fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
        const res = await getRequest("/x/");
        expect(res).toEqual({
            success: false,
            status: 0,
            kind: "network",
            error: ERROR_MESSAGES.network,
            data: null,
        });
        log.mockRestore();
    });

    it("reports a timeout when the request is aborted", async () => {
        const abort = new Error("Aborted");
        abort.name = "AbortError";
        fetchMock.mockRejectedValueOnce(abort);
        const res = await getRequest("/x/");
        expect(res).toMatchObject({ success: false, status: 0, kind: "timeout", error: ERROR_MESSAGES.timeout });
    });

    it("aborts a request that takes longer than the timeout", async () => {
        jest.useFakeTimers();
        try {
            fetchMock.mockImplementationOnce(
                (url, { signal }) =>
                    new Promise((resolve, reject) => {
                        signal.addEventListener("abort", () => {
                            const err = new Error("Aborted");
                            err.name = "AbortError";
                            reject(err);
                        });
                    })
            );
            const pending = getRequest("/slow/");
            await jest.advanceTimersByTimeAsync(20000);
            expect((await pending).kind).toBe("timeout");
        } finally {
            jest.useRealTimers();
        }
    });
});

describe("buildFormData", () => {
    it("flattens nested objects and arrays and skips null / undefined", () => {
        const append = jest.spyOn(FormData.prototype, "append").mockImplementation(() => {});
        buildFormData({
            name: "Juan",
            profile: { address: "Manila", age: 30 },
            tags: ["a", "b"],
            empty: null,
            missing: undefined,
            photo: { uri: "file:///p.jpg" },
        });
        const calls = append.mock.calls;
        append.mockRestore();
        expect(calls.map(([key]) => key)).toEqual([
            "name",
            "profile.address",
            "profile.age",
            "tags[0]",
            "tags[1]",
            "photo",
        ]);
        expect(calls[0][1]).toBe("Juan");
        // on native a picked image becomes an expo-file-system File (mocked in setup.js)
        expect(calls[5][1]).toMatchObject({ uri: "file:///p.jpg", name: "p.jpg" });
    });
});
