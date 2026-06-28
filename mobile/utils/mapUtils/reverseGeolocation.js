export async function ReverseGeolocation(lat, lng) {
const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    {
        headers: {
            
            "User-Agent": "TodaGoo/1.0 (TodaGoo@gmail.com)",
            Accept: "application/json",
        },
        }
    );    

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Nominatim error ${res.status}: ${text.slice(0, 100)}`);
    }

    const data = await res.json();

    return {
        lat,
        lng,
        city:
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        "",
        country: data.address?.country || "",
        full: data.display_name || "",
    };
}