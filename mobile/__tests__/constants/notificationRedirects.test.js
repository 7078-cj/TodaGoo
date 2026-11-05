import { router } from "expo-router";
import { followNotification, getNotificationRedirect } from "../../constants/notificationRedirects";
import * as chatStore from "../../utils/chatRequestStore";
import * as reportStore from "../../utils/reportRequestStore";

beforeEach(() => jest.clearAllMocks());

describe("getNotificationRedirect", () => {
    it("sends a passenger to the trip screen for an accepted, still-active booking", () => {
        expect(getNotificationRedirect({ type: "booking_accepted", booking_status: "accepted" }, "passenger")).toEqual({
            pathname: "/(protected)/passenger/en_route",
            openChat: false,
            openReport: false,
        });
    });

    it("doesn't redirect for a ride that has ended", () => {
        expect(getNotificationRedirect({ type: "booking_accepted", booking_status: "completed" }, "passenger")).toBeNull();
        expect(getNotificationRedirect({ type: "new_message", booking_status: "cancelled" }, "driver")).toBeNull();
    });

    it("doesn't redirect a role that has no path", () => {
        expect(getNotificationRedirect({ type: "booking_accepted", booking_status: "accepted" }, "driver")).toBeNull();
        expect(getNotificationRedirect({ type: "driver_nearby", booking_status: "in_progress" }, "driver")).toBeNull();
    });

    it("opens the chat for a message, for both roles", () => {
        for (const role of ["passenger", "driver"]) {
            expect(getNotificationRedirect({ type: "new_message", booking_status: "in_progress" }, role)).toEqual({
                pathname: `/(protected)/${role}/en_route`,
                openChat: true,
                openReport: false,
            });
        }
    });

    it("opens the report for a report update, whatever the booking status", () => {
        expect(getNotificationRedirect({ type: "report_update" }, "driver")).toEqual({
            pathname: "/(protected)/profile",
            openChat: false,
            openReport: true,
        });
    });

    it("never redirects general or unknown notifications", () => {
        expect(getNotificationRedirect({ type: "general" }, "passenger")).toBeNull();
        expect(getNotificationRedirect({ type: "something_new" }, "passenger")).toBeNull();
        expect(getNotificationRedirect(null, "passenger")).toBeNull();
    });
});

describe("followNotification", () => {
    const rootState = { routes: [] };

    it("requests the chat and navigates for a message", () => {
        const requestChat = jest.spyOn(chatStore, "requestChat");
        const ok = followNotification(
            { type: "new_message", booking_status: "accepted", booking_id: 42 },
            "driver",
            rootState
        );
        expect(ok).toBe(true);
        expect(requestChat).toHaveBeenCalledWith(42);
        expect(router.push).toHaveBeenCalledWith("/(protected)/driver/en_route");
        chatStore.clearChatRequest();
    });

    it("requests the report and navigates for a report update", () => {
        const requestReport = jest.spyOn(reportStore, "requestReport");
        expect(followNotification({ type: "report_update", report_id: 9 }, "passenger", rootState)).toBe(true);
        expect(requestReport).toHaveBeenCalledWith(9);
        expect(router.push).toHaveBeenCalledWith("/(protected)/profile");
        reportStore.clearReportRequest();
    });

    it("returns false and does nothing without a redirect", () => {
        expect(followNotification({ type: "general" }, "passenger", rootState)).toBe(false);
        expect(router.push).not.toHaveBeenCalled();
        expect(router.dismissTo).not.toHaveBeenCalled();
    });
});
