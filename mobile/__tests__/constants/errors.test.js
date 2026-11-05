import { ERROR_MESSAGES, firstErrorMessage, getErrorMessage } from "../../constants/errors";

describe("firstErrorMessage", () => {
    it.each([
        [null, null],
        [undefined, null],
        ["plain text", "plain text"],
        [{ detail: "Not allowed." }, "Not allowed."],
        [{ message: "Bad." }, "Bad."],
        [{ non_field_errors: ["Wrong password."] }, "Wrong password."],
        [{ username: ["Already taken."] }, "Already taken."],
        [{ profile: { contact_number: ["Invalid number."] } }, "Invalid number."],
        [["first", "second"], "first"],
        [[null, ["nested"]], "nested"],
        [{}, null],
        [[], null],
    ])("%p → %p", (data, expected) => {
        expect(firstErrorMessage(data)).toBe(expected);
    });

    it("prefers detail / message / error / non_field_errors over field errors", () => {
        expect(firstErrorMessage({ username: ["field"], detail: "detail" })).toBe("detail");
    });
});

describe("getErrorMessage", () => {
    it("returns the fallback for nothing", () => {
        expect(getErrorMessage(null)).toBe(ERROR_MESSAGES.generic);
        expect(getErrorMessage(undefined, "custom")).toBe("custom");
    });

    it("reads strings, request results and Errors", () => {
        expect(getErrorMessage("oops")).toBe("oops");
        expect(getErrorMessage({ error: "from request" })).toBe("from request");
        expect(getErrorMessage(new Error("from error"))).toBe("from error");
        expect(getErrorMessage({}, "fallback")).toBe("fallback");
    });
});
