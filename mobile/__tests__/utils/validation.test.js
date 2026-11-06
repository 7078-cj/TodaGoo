import { normalizePhone, normalizeUsername, passwordProblem } from "../../utils/validation";

describe("normalizePhone", () => {
    it.each(["09171234567", "0917 123 4567", "0917-123-4567", "+63 917 123 4567", "639171234567", "9171234567"])(
        "%p -> 09171234567",
        (raw) => {
            expect(normalizePhone(raw)).toBe("09171234567");
        }
    );

    it.each(["", null, undefined, "12345", "08171234567", "091712345678", "0917123456", "+1 917 123 4567", "abc"])(
        "%p is not a PH mobile number",
        (raw) => {
            expect(normalizePhone(raw)).toBeNull();
        }
    );
});

describe("passwordProblem", () => {
    it.each([
        ["", "Password is required"],
        ["Ab1!", "Minimum 8 characters"],
        ["lowercase1!", "Must contain at least 1 uppercase letter"],
        ["NoNumbers!!", "Must contain at least 1 number"],
        ["NoSymbols123", "Must contain at least 1 special character"],
    ])("%p -> %p", (password, problem) => {
        expect(passwordProblem(password)).toBe(problem);
    });

    it("accepts a password that follows every rule", () => {
        expect(passwordProblem("N3w-Secret!pass")).toBeNull();
    });
});

describe("normalizeUsername", () => {
    it("still trims and joins words with underscores", () => {
        expect(normalizeUsername("  juan  dela cruz ")).toBe("juan_dela_cruz");
    });
});
