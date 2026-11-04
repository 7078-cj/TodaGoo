// Distance and duration of a finished ride, for the receipt (the backend doesn't store either).

const R = 6371; // km
const toRad = (deg) => (deg * Math.PI) / 180;

function haversineKm(a, b) {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const isPoint = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng);

// Along the saved route polyline when there is one, otherwise straight lines start → stops → end
export function rideDistanceKm(booking) {
    const route = Array.isArray(booking?.routes) ? booking.routes.filter(isPoint) : [];
    const points =
        route.length > 1
            ? route
            : [booking?.start, ...(booking?.stops ?? []).map((s) => s.location), booking?.end].filter(isPoint);
    let km = 0;
    for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
    return points.length > 1 ? km : null;
}

// From booking to completion (created_at → updated_at), in whole minutes
export function rideDurationMin(booking) {
    const start = new Date(booking?.created_at).getTime();
    const end = new Date(booking?.updated_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return Math.max(1, Math.round((end - start) / 60000));
}

// "850 m" / "1.2 km" / "12 km"
export function formatDistance(km) {
    if (km == null) return "—";
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km < 10 ? km.toFixed(1).replace(/\.0$/, "") : Math.round(km)} km`;
}

export function formatDuration(min) {
    if (min == null) return "—";
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)} h ${min % 60} min`;
}
