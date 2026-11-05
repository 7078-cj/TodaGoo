import { PICKUP_RADIUS_M, distanceToPickupM, isNearPickup } from "../../utils/pickupProximity";
import { formatDistance, formatDuration, rideDistanceKm, rideDurationMin } from "../../utils/rideStats";

const pickup = { lat: 14.9613, lng: 120.7582 };
// 0.0009° of latitude ≈ 100 m, 0.0018° ≈ 200 m
const coords = (dLat) => ({ latitude: pickup.lat + dLat, longitude: pickup.lng });

describe("pickupProximity", () => {
    it("is 0 m at the pickup point", () => {
        expect(distanceToPickupM({ start: pickup }, coords(0))).toBeCloseTo(0, 5);
    });

    it("measures roughly 100 m for 0.0009° of latitude", () => {
        expect(distanceToPickupM({ start: pickup }, coords(0.0009))).toBeCloseTo(100, -1);
    });

    it("returns null when the booking or the coordinates are missing", () => {
        expect(distanceToPickupM(null, coords(0))).toBeNull();
        expect(distanceToPickupM({}, coords(0))).toBeNull();
        expect(distanceToPickupM({ start: pickup }, null)).toBeNull();
        expect(distanceToPickupM({ start: pickup }, { latitude: 1 })).toBeNull();
    });

    it("is near within the pickup radius and not beyond it", () => {
        expect(PICKUP_RADIUS_M).toBe(150);
        expect(isNearPickup({ start: pickup }, coords(0.0009))).toBe(true);
        expect(isNearPickup({ start: pickup }, coords(0.0018))).toBe(false);
        expect(isNearPickup({ start: pickup }, null)).toBe(false);
    });
});

describe("rideDistanceKm", () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 0.01 }; // ≈ 1.112 km along the equator
    const c = { lat: 0, lng: 0.02 };

    it("follows the saved route when it has two or more points", () => {
        expect(rideDistanceKm({ routes: [a, b, c], start: a, end: a })).toBeCloseTo(2.224, 2);
    });

    it("falls back to start → stops → end", () => {
        expect(rideDistanceKm({ routes: [], start: a, stops: [{ location: b }], end: c })).toBeCloseTo(2.224, 2);
    });

    it("skips points without valid coordinates", () => {
        expect(rideDistanceKm({ routes: [a, { lat: null, lng: 1 }, b] })).toBeCloseTo(1.112, 2);
    });

    it("returns null when there are fewer than two points", () => {
        expect(rideDistanceKm({ start: a })).toBeNull();
        expect(rideDistanceKm(null)).toBeNull();
    });
});

describe("rideDurationMin", () => {
    it("rounds to whole minutes", () => {
        expect(
            rideDurationMin({ created_at: "2026-11-05T10:00:00Z", updated_at: "2026-11-05T10:12:40Z" })
        ).toBe(13);
    });

    it("is at least 1 minute", () => {
        expect(
            rideDurationMin({ created_at: "2026-11-05T10:00:00Z", updated_at: "2026-11-05T10:00:05Z" })
        ).toBe(1);
    });

    it("returns null for missing or reversed times", () => {
        expect(rideDurationMin({})).toBeNull();
        expect(
            rideDurationMin({ created_at: "2026-11-05T10:00:00Z", updated_at: "2026-11-05T09:00:00Z" })
        ).toBeNull();
    });
});

describe("formatDistance / formatDuration", () => {
    it.each([
        [null, "—"],
        [0.85, "850 m"],
        [1, "1 km"],
        [1.24, "1.2 km"],
        [12.6, "13 km"],
    ])("formatDistance(%p) → %p", (km, expected) => {
        expect(formatDistance(km)).toBe(expected);
    });

    it.each([
        [null, "—"],
        [5, "5 min"],
        [60, "1 h 0 min"],
        [135, "2 h 15 min"],
    ])("formatDuration(%p) → %p", (min, expected) => {
        expect(formatDuration(min)).toBe(expected);
    });
});
