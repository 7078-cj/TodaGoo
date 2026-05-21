

export async function fetchOsrmRoutes({
    coordinates, // [{lat, lng}, ...]
    setRoutes,
    setIsLoading,
    options = {},
}) {
    try {
    if (!coordinates || coordinates.length < 2) {
        throw new Error("At least 2 coordinates are required");
    }

    setIsLoading?.(true);

    const baseUrl = "https://router.project-osrm.org/route/v1/driving/";

    // Convert to OSRM format: lng,lat;lng,lat
    const coordsString = coordinates
        .map((c) => `${c.lng},${c.lat}`)
        .join(";");

    const defaultOptions = {
        overview: "full",
        geometries: "geojson",
        alternatives: "true",
    };

    const finalOptions = { ...defaultOptions, ...options };

    const queryString = Object.entries(finalOptions)
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

    const url = `${baseUrl}${coordsString}?${queryString}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
        setRoutes([]);
        return;
    }

    const routeData = data.routes.map((route) => ({
        coordinates: route.geometry.coordinates,
        duration: route.duration,
        distance: route.distance,
    }));

    setRoutes(routeData);
    } catch (error) {
    console.error("OSRM fetch error:", error);
    setRoutes([]);
    } finally {
    setIsLoading?.(false);
    }
}