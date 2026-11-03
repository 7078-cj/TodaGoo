// Keep in sync with PICKUP_RADIUS_M in backend/api/features/booking/helpers/pickup_proximity.py
export const PICKUP_RADIUS_M = 150;

const toRad = (deg) => (deg * Math.PI) / 180;

// Metres between the driver ({ latitude, longitude }) and the booking's pickup point, or null if unknown
export function distanceToPickupM(booking, coords) {
    if (!booking?.start || coords?.latitude == null || coords?.longitude == null) return null;

    const R = 6371000;
    const dLat = toRad(booking.start.lat - coords.latitude);
    const dLng = toRad(booking.start.lng - coords.longitude);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(coords.latitude)) * Math.cos(toRad(booking.start.lat)) * Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isNearPickup(booking, coords) {
    const distance = distanceToPickupM(booking, coords);
    return distance != null && distance <= PICKUP_RADIUS_M;
}
