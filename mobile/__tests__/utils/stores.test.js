import { act, renderHook } from "@testing-library/react-native";
import { setActiveBooking, useHasActiveBooking } from "../../utils/activeBookingStore";
import { clearChatRequest, requestChat, useChatRequested } from "../../utils/chatRequestStore";
import { clearReportRequest, requestReport, useReportRequest } from "../../utils/reportRequestStore";

describe("activeBookingStore", () => {
    afterEach(() => act(() => setActiveBooking(null)));

    it.each([
        ["accepted", true],
        ["in_progress", true],
        ["pending", false],
        ["completed", false],
        ["cancelled", false],
    ])("a %p booking → active = %p", async (status, expected) => {
        const { result } = await renderHook(() => useHasActiveBooking());
        expect(result.current).toBe(false);
        await act(() => setActiveBooking({ status }));
        expect(result.current).toBe(expected);
    });

    it("goes back to false when the booking is cleared", async () => {
        const { result } = await renderHook(() => useHasActiveBooking());
        await act(() => setActiveBooking({ status: "accepted" }));
        expect(result.current).toBe(true);
        await act(() => setActiveBooking(null));
        expect(result.current).toBe(false);
    });
});

describe("chatRequestStore", () => {
    afterEach(() => act(() => clearChatRequest()));

    it("is true only for the requested booking until it's cleared", async () => {
        const forBooking7 = await renderHook(() => useChatRequested(7));
        const forBooking8 = await renderHook(() => useChatRequested(8));
        expect(forBooking7.result.current).toBe(false);

        await act(() => requestChat(7));
        expect(forBooking7.result.current).toBe(true);
        expect(forBooking8.result.current).toBe(false);

        await act(() => clearChatRequest());
        expect(forBooking7.result.current).toBe(false);
    });

    it("is false without a booking id", async () => {
        await act(() => requestChat(null));
        const { result } = await renderHook(() => useChatRequested(null));
        expect(result.current).toBe(false);
    });
});

describe("reportRequestStore", () => {
    afterEach(() => act(() => clearReportRequest()));

    it("holds the requested report until it's cleared", async () => {
        const { result } = await renderHook(() => useReportRequest());
        expect(result.current).toBeNull();
        await act(() => requestReport(12));
        expect(result.current).toEqual({ reportId: 12 });
        await act(() => clearReportRequest());
        expect(result.current).toBeNull();
    });

    it("ignores a missing report id", async () => {
        const { result } = await renderHook(() => useReportRequest());
        await act(() => requestReport(undefined));
        expect(result.current).toBeNull();
    });
});
