export async function fetchOsrmRoutes({
    coordinates,
    setRoutes,
    setIsLoading,
    signal,
}) {
    try {
        if (!coordinates || coordinates.length < 2) {
            throw new Error("At least 2 coordinates are required");
        }

        setIsLoading?.(true);

        const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY;

        const response = await fetch(
            "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
            {
                method: "POST",
                signal,
                headers: {
                    Authorization: ORS_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    coordinates: coordinates.map((c) => [c.lng, c.lat]),
                }),
            }
        );

        const data = await response.json();

        if (!response.ok || !data.features?.length) {
            throw new Error(data.error?.message || "Failed to fetch route");
        }

        const feature = data.features[0];

        const routeData = [
            {
                // [lng, lat]
                coordinates: feature.geometry.coordinates,
                distance: feature.properties.summary.distance,
                duration: feature.properties.summary.duration,
            },
        ];

        setRoutes(routeData);
    } catch (error) {
        if (error.name === "AbortError") {
            return;
        }

        console.error("ORS fetch error:", error);
        setRoutes([]);
    } finally {
        setIsLoading?.(false);
    }
}