import formatCoordinates from "../../utils/formatCoordinates";
import formatDateTime, { formatDate } from "../../utils/formatDateTime";
import formatPhone from "../../utils/formatPhone";
import timeAgo from "../../utils/timeAgo";
import { normalizeUsername } from "../../utils/validation";

describe("formatCoordinates", () => {
    it("formats a north-east point as degrees / minutes / seconds", () => {
        expect(formatCoordinates({ lat: 14.5, lng: 120.75 })).toBe(`N 14° 30' 0.000" E 120° 45' 0.000"`);
    });

    it("keeps three decimals on the seconds", () => {
        expect(formatCoordinates({ lat: 14.961302, lng: 120.75822 })).toMatch(
            /^N 14° 57' 40\.68\d" E 120° 45' 29\.59\d"$/
        );
    });

    it("uses S and W for negative values", () => {
        expect(formatCoordinates({ lat: -33.5, lng: -70.25 })).toBe(`S 33° 30' 0.000" W 70° 15' 0.000"`);
    });

    it("accepts numeric strings", () => {
        expect(formatCoordinates({ lat: "0", lng: "0" })).toBe(`N 0° 0' 0.000" E 0° 0' 0.000"`);
    });

    it.each([[null], [undefined], [{}], [{ lat: "abc", lng: 1 }], [{ lat: 1, lng: Infinity }]])(
        "returns an empty string for %p",
        (location) => {
            expect(formatCoordinates(location)).toBe("");
        }
    );
});

describe("formatDateTime / formatDate", () => {
    // built from local time so the result doesn't depend on the machine's time zone
    const morning = new Date(2026, 5, 5, 9, 7).toISOString();
    const evening = new Date(2026, 5, 15, 22, 30).toISOString();
    const noon = new Date(2026, 0, 1, 12, 0).toISOString();
    const midnight = new Date(2026, 11, 31, 0, 5).toISOString();

    it("formats date and 12-hour time", () => {
        expect(formatDateTime(morning)).toBe("June 05, 2026, 09:07 AM");
        expect(formatDateTime(evening)).toBe("June 15, 2026, 10:30 PM");
    });

    it("shows noon as 12 PM and midnight as 12 AM", () => {
        expect(formatDateTime(noon)).toBe("January 01, 2026, 12:00 PM");
        expect(formatDateTime(midnight)).toBe("December 31, 2026, 12:05 AM");
    });

    it("formatDate shows the date only, without padding the day", () => {
        expect(formatDate(morning)).toBe("June 5, 2026");
    });

    it.each([[""], [null], [undefined], ["not a date"]])("returns an empty string for %p", (value) => {
        expect(formatDateTime(value)).toBe("");
        expect(formatDate(value)).toBe("");
    });
});

describe("formatPhone", () => {
    it("formats an 11-digit local number as +63", () => {
        expect(formatPhone("09123456745")).toBe("+63 912 345 6745");
    });

    it("ignores separators in the input", () => {
        expect(formatPhone("0912-345-6745")).toBe("+63 912 345 6745");
    });

    it("returns other values unchanged", () => {
        expect(formatPhone("+639123456745")).toBe("+639123456745");
        expect(formatPhone("12345")).toBe("12345");
    });

    it("returns an empty string for null / undefined", () => {
        expect(formatPhone(null)).toBe("");
        expect(formatPhone(undefined)).toBe("");
    });
});

describe("timeAgo", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const ago = (ms) => new Date(now.getTime() - ms).toISOString();

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(now);
    });
    afterEach(() => jest.useRealTimers());

    it.each([
        [0, "Just now"],
        [59 * 1000, "Just now"],
        [60 * 1000, "1m ago"],
        [59 * 60 * 1000, "59m ago"],
        [3 * 3600 * 1000, "3h ago"],
        [2 * 86400 * 1000, "2d ago"],
    ])("%p ms ago → %p", (ms, expected) => {
        expect(timeAgo(ago(ms))).toBe(expected);
    });

    it("treats future times as just now", () => {
        expect(timeAgo(new Date(now.getTime() + 60000).toISOString())).toBe("Just now");
    });

    it("shows the date for anything a week or older", () => {
        const old = ago(8 * 86400 * 1000);
        expect(timeAgo(old)).toBe(new Date(old).toLocaleDateString());
    });
});

describe("normalizeUsername", () => {
    it("trims and replaces runs of whitespace with one underscore", () => {
        expect(normalizeUsername("  juan   dela  cruz ")).toBe("juan_dela_cruz");
    });

    it("leaves a plain username alone", () => {
        expect(normalizeUsername("juan_23")).toBe("juan_23");
    });
});
