// 14.961302, 120.758220 → `N 14° 57' 40.687" E 120° 45' 29.593"`
function toDms(value, positive, negative) {
    const abs = Math.abs(value);
    const degrees = Math.floor(abs);
    const minutesFloat = (abs - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = ((minutesFloat - minutes) * 60).toFixed(3);
    return `${value >= 0 ? positive : negative} ${degrees}° ${minutes}' ${seconds}"`;
}

export default function formatCoordinates(location) {
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    return `${toDms(lat, "N", "S")} ${toDms(lng, "E", "W")}`;
}
