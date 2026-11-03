/* ---- Media files come back as relative paths like /media/driver_profiles/x.png ----
   Set this to your server origin (no trailing slash, no /api), e.g.
   EXPO_PUBLIC_API_URL=http://192.168.1.78:8000  */
const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || "")
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");

export const mediaUrl = (path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// The other party of a booking: a driver sees the passenger, a passenger sees the driver
export function getPerson(booking, isDriver) {
    const p = isDriver ? booking?.passenger : booking?.driver;
    if (!p || typeof p !== "object") return null;

    const name = [p.first_name, p.last_name].filter(Boolean).map(cap).join(" ") || p.username || "";

    return {
        role: isDriver ? "passenger" : "driver",
        name,
        phone: p.contact_number ?? "",
        photo: mediaUrl(p.profile_picture),
        rating: p.rating != null ? Number(p.rating) : null,
        address: p.address ?? null,
        todaNumber: p.toda_number ?? null,
        plate: p.vehicle_plate ?? null,
        vehicleFront: mediaUrl(p.vehicle_front_picture),
        vehicleBack: mediaUrl(p.vehicle_back_picture),
    };
}
