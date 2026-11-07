// Ride History details: the "Activity" section lists booking.logs (backend BookingLog, from
// booking/history/) oldest first, with the time of each.
import React from "react";
import { render, screen, within } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import BookingHistoryModal from "../../components/history/BookingHistoryModal";

jest.mock("../../components/map/MapComponent", () => require("../flows/screenMocks").mapComponent);

const at = (h, m) => new Date(2026, 10, 7, h, m).toISOString();
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const ride = (logs) => ({
    id: 12,
    status: "completed",
    price: 22,
    created_at: at(9, 0),
    updated_at: at(9, 25),
    start: { lat: 14.84, lng: 120.81 },
    end: { lat: 14.85, lng: 120.82 },
    start_address: "Malolos Cathedral",
    end_address: "Robinsons Malolos",
    stops: [],
    routes: [],
    ratings: [],
    messages: [],
    passenger: { id: 1, first_name: "maria", last_name: "santos", username: "maria" },
    driver: { id: 2, first_name: "pedro", last_name: "reyes", username: "pedro", vehicle_plate: "TRY 123" },
    logs,
});

const LOGS = [
    { id: 1, event: "requested", message: "Ride requested: Malolos Cathedral → Robinsons Malolos (₱22).", created_at: at(9, 0) },
    { id: 2, event: "offered", message: "Offered to a nearby driver.", created_at: at(9, 0) },
    { id: 3, event: "accepted", message: "Accepted by Pedro Reyes (TRY 123).", created_at: at(9, 1) },
    { id: 4, event: "picked_up", message: "Passenger picked up.", created_at: at(9, 8) },
    { id: 5, event: "completed", message: "Ride completed.", created_at: at(9, 25) },
    { id: 6, event: "something_new", message: "A new kind of event.", created_at: at(9, 30) },
];

async function open(booking, isDriver = false) {
    await render(
        <SafeAreaProvider initialMetrics={METRICS}>
            <BookingHistoryModal booking={booking} visible onClose={() => {}} currentUserId={1} isDriver={isDriver} />
        </SafeAreaProvider>
    );
}

describe("ride details: Activity", () => {
    it("lists every log entry in order with its time", async () => {
        await open(ride(LOGS));
        expect(screen.getByText("Activity")).toBeTruthy();
        const rows = screen.getAllByTestId(/^log-/);
        expect(rows.map((r) => r.props.testID)).toEqual([
            "log-requested", "log-offered", "log-accepted", "log-picked_up", "log-completed", "log-something_new",
        ]);
        expect(within(rows[2]).getByText("Accepted by Pedro Reyes (TRY 123).")).toBeTruthy();
        expect(within(rows[2]).getByText("09:01 AM")).toBeTruthy();
        expect(within(rows[4]).getByText("09:25 AM")).toBeTruthy();
    });

    it("an unknown event still shows (with the default icon)", async () => {
        await open(ride(LOGS));
        expect(within(screen.getByTestId("log-something_new")).getByText("A new kind of event.")).toBeTruthy();
    });

    it("the driver sees the same activity", async () => {
        await open(ride(LOGS), true);
        expect(screen.getAllByTestId(/^log-/)).toHaveLength(LOGS.length);
    });

    it.each([[[]], [undefined]])("no logs (%p): says so", async (logs) => {
        await open(ride(logs));
        expect(screen.getByText("No activity was recorded for this ride.")).toBeTruthy();
        expect(screen.queryAllByTestId(/^log-/)).toHaveLength(0);
    });

    it("comes before the chat log", async () => {
        await open(ride(LOGS));
        const titles = screen.getAllByText(/^(Activity|Chat log)$/).map((t) => t.props.children);
        expect(titles).toEqual(["Activity", "Chat log"]);
    });
});
