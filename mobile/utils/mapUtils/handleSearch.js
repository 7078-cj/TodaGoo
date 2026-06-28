export async function handleSearch(searchQuery, setLocation, mapHandleRef) {
    if (!searchQuery) return;

    try {
        const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery
        )}`,
        {
            headers: {
                
                "User-Agent": "TodaGoo/1.0 (TodaGoo@gmail.com)",
                Accept: "application/json",
            },
            }
        );
        const data = await res.json();

        if (data.length > 0) {
        const { lat, lon } = data[0];
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lon);

        // Recenter the Leaflet WebView map
        mapHandleRef.current?.recenter({ lat: parsedLat, lng: parsedLng }, 16);

        setLocation({
            lat: parsedLat,
            lng: parsedLng,
            city: data[0].display_name,
            country: "",
            full: data[0].display_name,
        });
        }
    } catch (err) {
        console.error("Search failed:", err);
    }
}