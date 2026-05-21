export async function ReverseGeolocation(lat, lng){
    const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    );
        const data = await res.json();
        const newLoc = {
        lat,
        lng,
        city:
            data.address.city ||
            data.address.town ||
            data.address.village ||
            "",
        country: data.address.country || "",
        full: data.display_name || "",
        };
    return newLoc
}

export default async function MapClickHandler({ lat, lng, setLocation, editMode }) {
    if (!editMode) return;

    try {
    const res = await ReverseGeolocation(lat, lng)

    setLocation(res);
    } catch (err) {
        console.error("Reverse geocoding failed:", err);
        setLocation({ lat, lng, city: "", country: "", full: "" });
    }
}

export const initLocation = async (location, setLocation) => {

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
            try {
                var newLoc = await ReverseGeolocation(lat, lng) 
                setLocation(newLoc);
            } catch {
                setLocation({ lat, lng, city: "", country: "", full: "" });
            }
        },
            (err) => console.error("Geolocation error:", err)
        );
        }
    };

export  const handleSearch = async (searchQuery, setLocation, mapRef) => {
    if (!searchQuery) return;

    // Use OpenStreetMap Nominatim API for geocoding
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        if (data.length > 0) {
        const { lat, lon } = data[0];

        // Center the map to the searched location
        mapRef.current?.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 16 });

        // Optionally, update location state
        setLocation({
            lat: parseFloat(lat),
            lng: parseFloat(lon),
            city: data[0].display_name,
            country: "",
            full: data[0].display_name,
        });
        }
    } catch (err) {
        console.error("Search failed:", err);
    }
    };