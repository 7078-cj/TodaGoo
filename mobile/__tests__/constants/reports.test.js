import { REPORT_STATUSES, formatReportId } from "../../constants/reports";

describe("REPORT_STATUSES", () => {
    it("has one entry per backend status, in order", () => {
        expect(REPORT_STATUSES.map((s) => s.status)).toEqual(["open", "relayed_to_mdrrmo", "resolved", "dismissed"]);
    });

    it("labels the relayed status for the badge and filter tab", () => {
        expect(REPORT_STATUSES.find((s) => s.status === "relayed_to_mdrrmo")).toMatchObject({
            label: "Relayed to MDRRMO",
            color: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        });
    });

    it("every status has a label and a colour", () => {
        REPORT_STATUSES.forEach((s) => {
            expect(s.label).toBeTruthy();
            expect(s.color).toMatch(/^#[0-9A-F]{6}$/i);
        });
    });
});

describe("formatReportId", () => {
    it("pads to three digits", () => {
        expect(formatReportId(7)).toBe("#IR-007");
        expect(formatReportId(1234)).toBe("#IR-1234");
    });
});
