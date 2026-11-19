import React, { useState, useRef, useEffect, useMemo } from "react";
import {
    Map,
    MapMarker,
    MarkerContent,
    MarkerPopup,
    MarkerTooltip,
    MapRoute,
    useMap,
} from "@/components/ui/map";
import { MapEventListener } from "../utils/map_utils/mapEventListener";
import { handleSearch } from "../utils/map_utils/map";
import SearchInput from "./SearchInput";
import { fetchOsrmRoutes } from "../utils/map_utils/fetch_routes";

const media_url = import.meta.env.VITE_MEDIA_URL;

const ROUTE_COLORS = [
    "#4285F4", "#EA4335", "#FBBC05", "#34A853",
    "#FF6D00", "#7B1FA2", "#0288D1", "#00796B",
];

const AREA_COLORS = [
    "#4285F4", "#EA4335", "#FBBC05", "#34A853",
    "#FF6D00", "#7B1FA2", "#0288D1", "#00796B",
];

/**
 * Normalise an area entry into a GeoJSON Polygon feature.
 *
 * Accepted shapes:
 *  1. Raw coordinate ring  – [[lng,lat], [lng,lat], ...]
 *  2. Array of rings       – [[[lng,lat],...], [[lng,lat],...]]   (polygon with holes)
 *  3. GeoJSON Feature      – { type:"Feature", geometry:{...}, properties:{...} }
 *  4. GeoJSON Geometry     – { type:"Polygon"|"MultiPolygon", coordinates:[...] }
 */
function normaliseArea(area, index) {
    // Already a GeoJSON Feature
    if (area?.type === "Feature") {
        return {
            id: area.id ?? `area-${index}`,
            label: area.properties?.name ?? area.properties?.label ?? `Area ${index + 1}`,
            color: area.properties?.color ?? AREA_COLORS[index % AREA_COLORS.length],
            fillOpacity: area.properties?.fillOpacity ?? 0.25,
            lineOpacity: area.properties?.lineOpacity ?? 0.85,
            lineWidth: area.properties?.lineWidth ?? 2,
            feature: area,
        };
    }

    // GeoJSON Geometry
    if (area?.type === "Polygon" || area?.type === "MultiPolygon") {
        return {
            id: `area-${index}`,
            label: `Area ${index + 1}`,
            color: AREA_COLORS[index % AREA_COLORS.length],
            fillOpacity: 0.25,
            lineOpacity: 0.85,
            lineWidth: 2,
            feature: { type: "Feature", properties: {}, geometry: area },
        };
    }

    // Plain coordinate array – detect whether it's a single ring or multi-ring
    if (Array.isArray(area)) {
        const firstItem = area[0];

        let rings;
        if (Array.isArray(firstItem) && Array.isArray(firstItem[0])) {
            // Array of rings  →  [[lng,lat], ...][]
            rings = area;
        } else {
            // Single ring  →  [[lng,lat], ...]
            rings = [area];
        }

        // Auto-close each ring if needed
        rings = rings.map((ring) => {
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                return [...ring, first];
            }
            return ring;
        });

        return {
            id: `area-${index}`,
            label: `Area ${index + 1}`,
            color: AREA_COLORS[index % AREA_COLORS.length],
            fillOpacity: 0.25,
            lineOpacity: 0.85,
            lineWidth: 2,
            feature: {
                type: "Feature",
                properties: {},
                geometry: { type: "Polygon", coordinates: rings },
            },
        };
    }

    // Structured area object  { id?, label?, color?, coordinates, ... }
    if (area?.coordinates) {
        const normalised = normaliseArea(area.coordinates, index);
        return {
            ...normalised,
            id: area.id ?? normalised.id,
            label: area.label ?? area.name ?? normalised.label,
            color: area.color ?? normalised.color,
            fillOpacity: area.fillOpacity ?? normalised.fillOpacity,
            lineOpacity: area.lineOpacity ?? normalised.lineOpacity,
            lineWidth: area.lineWidth ?? normalised.lineWidth,
        };
    }

    console.warn("[MapComponent] Could not normalise area at index", index, area);
    return null;
}

/**
 * Bounding box [[minLng, minLat], [maxLng, maxLat]] covering the given
 * normalised areas. Returns null if there are no valid coordinates.
 */
function getAreasBounds(normalisedAreas) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

    const visit = (c) => {
        if (typeof c[0] === "number") {
            minLng = Math.min(minLng, c[0]);
            maxLng = Math.max(maxLng, c[0]);
            minLat = Math.min(minLat, c[1]);
            maxLat = Math.max(maxLat, c[1]);
        } else {
            c.forEach(visit);
        }
    };

    normalisedAreas.forEach(({ feature }) => visit(feature.geometry.coordinates));

    return Number.isFinite(minLng) ? [[minLng, minLat], [maxLng, maxLat]] : null;
}

// ---------------------------------------------------------------------------
// AreaLayers – inner component that consumes the MapLibre map instance via
// the useMap() hook (same pattern as the documentation example).
// ---------------------------------------------------------------------------
function AreaLayers({ areas, enableClickZoom = true }) {
    const { map, isLoaded } = useMap();
    const [hoveredArea, setHoveredArea] = useState(null);
    const registeredIds = useRef(new Set());
    const registeredSources = useRef(new Set());

    // Only recompute when the actual area data changes
    const areasKey = JSON.stringify(areas);
    const normalisedAreas = useMemo(
        () => areas.map((a, i) => normaliseArea(a, i)).filter(Boolean),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [areasKey]
    );

    // Build / update layers whenever the map is ready or areas change
    useEffect(() => {
        if (!map || !isLoaded) return;

        const newLayerIds = new Set();
        const newSourceIds = new Set();

        normalisedAreas.forEach(({ id, color, fillOpacity, lineOpacity, lineWidth, feature }) => {
            const sourceId = `area-source-${id}`;
            const fillId = `area-fill-${id}`;
            const lineId = `area-line-${id}`;

            newLayerIds.add(fillId);
            newLayerIds.add(lineId);
            newSourceIds.add(sourceId);

            // Source
            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, {
                    type: "geojson",
                    data: { type: "FeatureCollection", features: [feature] },
                });
            } else {
                map.getSource(sourceId).setData({
                    type: "FeatureCollection",
                    features: [feature],
                });
            }

            // Fill layer
            if (!map.getLayer(fillId)) {
                map.addLayer({
                    id: fillId,
                    type: "fill",
                    source: sourceId,
                    paint: {
                        "fill-color": color,
                        "fill-opacity": fillOpacity,
                    },
                });
            } else {
                map.setPaintProperty(fillId, "fill-color", color);
                map.setPaintProperty(fillId, "fill-opacity", fillOpacity);
            }

            // Outline layer
            if (!map.getLayer(lineId)) {
                map.addLayer({
                    id: lineId,
                    type: "line",
                    source: sourceId,
                    paint: {
                        "line-color": color,
                        "line-width": lineWidth,
                        "line-opacity": lineOpacity,
                    },
                });
            } else {
                map.setPaintProperty(lineId, "line-color", color);
                map.setPaintProperty(lineId, "line-width", lineWidth);
                map.setPaintProperty(lineId, "line-opacity", lineOpacity);
            }
        });

        // Remove stale layers / sources that are no longer in the areas list
        registeredIds.current.forEach((layerId) => {
            if (!newLayerIds.has(layerId) && map.getLayer(layerId)) {
                map.removeLayer(layerId);
            }
        });
        registeredSources.current.forEach((sourceId) => {
            if (!newSourceIds.has(sourceId) && map.getSource(sourceId)) {
                map.removeSource(sourceId);
            }
        });

        registeredIds.current = newLayerIds;
        registeredSources.current = newSourceIds;
    }, [map, isLoaded, normalisedAreas]);

    // Fit the view to the full coverage of all areas (zoomed out a bit)
    useEffect(() => {
        if (!map || !isLoaded || !normalisedAreas.length) return;

        const bounds = getAreasBounds(normalisedAreas);
        if (!bounds) return;

        map.fitBounds(bounds, {
            padding: 60,   // breathing room around the polygons
            maxZoom: 15,   // never zoom in tighter than this
            duration: 800,
        });
    }, [map, isLoaded, normalisedAreas]);

    // Hover + click interactions
    useEffect(() => {
        if (!map || !isLoaded || !normalisedAreas.length) return;

        const fillLayerIds = normalisedAreas
            .map(({ id }) => `area-fill-${id}`)
            .filter((layerId) => map.getLayer(layerId));

        if (!fillLayerIds.length) return;

        const findHit = (point) => {
            const features = map.queryRenderedFeatures(point, { layers: fillLayerIds });
            if (!features.length) return null;
            const hitId = features[0].layer.id.replace("area-fill-", "");
            return normalisedAreas.find((a) => a.id === hitId) ?? null;
        };

        const handleMouseMove = (e) => {
            const hit = findHit(e.point);
            if (hit) {
                map.getCanvas().style.cursor = "pointer";
                setHoveredArea(hit.label);
            } else {
                map.getCanvas().style.cursor = "";
                setHoveredArea(null);
            }
        };

        const handleMouseLeave = () => {
            map.getCanvas().style.cursor = "";
            setHoveredArea(null);
        };

        // Click a boundary → fly to and fit that boundary
        const handleClick = (e) => {
            const hit = findHit(e.point);
            if (!hit) return;

            const bounds = getAreasBounds([hit]);
            if (!bounds) return;

            map.fitBounds(bounds, {
                padding: 80,
                maxZoom: 17,
                duration: 800,
            });
        };

        map.on("mousemove", handleMouseMove);
        map.on("mouseout", handleMouseLeave);
        if (enableClickZoom) map.on("click", handleClick);

        return () => {
            map.off("mousemove", handleMouseMove);
            map.off("mouseout", handleMouseLeave);
            if (enableClickZoom) map.off("click", handleClick);
        };
    }, [map, isLoaded, normalisedAreas, enableClickZoom]);

    // Cleanup all layers/sources on unmount
    useEffect(() => {
        return () => {
            // map may already be destroyed (e.g. user navigated away / logged out)
            // guard every call so we never touch a torn-down instance
            if (!map) return;
            try {
                if (!map.getStyle()) return; // map is destroyed if getStyle() returns null
            } catch {
                return;
            }
            registeredIds.current.forEach((layerId) => {
                try { if (map.getLayer(layerId)) map.removeLayer(layerId); } catch { /* already gone */ }
            });
            registeredSources.current.forEach((sourceId) => {
                try { if (map.getSource(sourceId)) map.removeSource(sourceId); } catch { /* already gone */ }
            });
        };
    }, [map]);

    return hoveredArea ? (
        <div className="absolute bottom-3 left-3 z-10 rounded-md border bg-background/90 px-3 py-2 text-sm font-medium backdrop-blur">
            {hoveredArea}
        </div>
    ) : null;
}

// ---------------------------------------------------------------------------
// Main MapComponent
// ---------------------------------------------------------------------------
export default function MapComponent({
    location = null,
    setLocation = null,
    Markers = [],
    editMode = false,
    userLocation = false,
    externalMapRef = null,
    routeSources = [],
    Search = false,
    reverse_lat = false,
    /**
     * areas – one or more polygon definitions. Each item may be:
     *   • A coordinate ring:          [[lng,lat], [lng,lat], ...]
     *   • An array of rings:          [[[lng,lat],...], ...]
     *   • A GeoJSON Geometry object:  { type:"Polygon", coordinates:[...] }
     *   • A GeoJSON Feature object:   { type:"Feature", geometry:{...}, properties:{...} }
     *   • A structured object:        { id, label, color, fillOpacity, lineWidth, coordinates }
     *
     * A single item (not wrapped in an array) is also accepted.
     */
    areas = [],
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [routeCoordinates, setRouteCoordinates] = useState({});
    const [mapReady, setMapReady] = useState(false);

    const internalMapRef = useRef(null);
    const mapRef = externalMapRef ?? internalMapRef;

    // Normalise areas so the inner component always receives an array
    const normalisedAreasProp = Array.isArray(areas) ? areas : areas ? [areas] : [];

    useEffect(() => {
        if (!mapReady) return;
        if (!location?.lat || !location?.lng) return;

        mapRef.current?.flyTo({
            center: [parseFloat(location.lng), parseFloat(location.lat)],
            zoom: 16,
        });
    }, [location, mapReady]);

    useEffect(() => {
        if (!mapReady || !userLocation) return;

        navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;

            mapRef.current?.flyTo({
                center: [longitude, latitude],
                zoom: 16,
            });
        });
    }, [userLocation, mapReady]);

    useEffect(() => {
        if (!routeSources.length) return;

        routeSources.forEach((source) => {
            if (!source.from || !source.to) return;

            fetchOsrmRoutes({
                coordinates: [source.from, source.to],
                setRoutes: (routes) => {
                    if (!routes.length) return;

                    setRouteCoordinates((prev) => ({
                        ...prev,
                        [source.id]: routes[0].coordinates,
                    }));
                },
            });
        });
    }, [routeSources]);

    return (
        <>
            {location && editMode && Search && (
                <SearchInput
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    action={() => handleSearch(searchQuery, setLocation, mapRef)}
                />
            )}

            <Map
                ref={mapRef}
                center={[120.75886839058785, 14.949553352698302]}
                zoom={16}
                onLoad={() => setMapReady(true)}
                styles={{
                    light: "https://tiles.openfreemap.org/styles/bright",
                    dark: "https://tiles.openfreemap.org/styles/bright",
                }}
            >
                {editMode && (
                    <MapEventListener setLocation={setLocation} editMode={editMode} reverse_lat={reverse_lat} />
                )}

                {/* Polygon / GeoJSON area overlays.
                    Click-to-center is disabled in editMode so it doesn't
                    clash with MapEventListener picking a location. */}
                {normalisedAreasProp.length > 0 && (
                    <AreaLayers areas={normalisedAreasProp} enableClickZoom={!editMode} />
                )}

                {/* Route polylines */}
                {routeSources.map((source, index) => {
                    const coords = routeCoordinates[source.id];
                    if (!coords?.length) return null;

                    return (
                        <MapRoute
                            key={source.id}
                            id={`route-${source.id}`}
                            coordinates={coords}
                            color={ROUTE_COLORS[index % ROUTE_COLORS.length]}
                            width={4}
                            opacity={0.75}
                        />
                    );
                })}

                {/* Custom markers */}
                {Markers.map((marker) =>
                    marker.latitude != null && marker.longitude != null ? (
                        <MapMarker
                            key={marker.id}
                            longitude={marker.longitude}
                            latitude={marker.latitude}
                        >
                            <MarkerContent>
                                <div className="w-9 h-9 rounded-full bg-rose-500 border-2 border-white shadow-lg cursor-pointer" />
                            </MarkerContent>

                            <MarkerTooltip>{marker.name}</MarkerTooltip>

                            <MarkerPopup>
                                <div className="p-2">
                                    <p>{marker.name}</p>
                                </div>
                            </MarkerPopup>
                        </MapMarker>
                    ) : null
                )}

                {/* Selected / edit location marker */}
                {location?.lat != null && location?.lng != null && (
                    <MapMarker longitude={location.lng} latitude={location.lat}>
                        <MarkerContent>
                            <div className="w-5 h-5 rounded-full bg-rose-500 border-2 border-white shadow-lg" />
                        </MarkerContent>

                        <MarkerPopup>
                            <div className="p-2">
                                <p>{location.full}</p>
                            </div>
                        </MarkerPopup>
                    </MapMarker>
                )}
            </Map>
        </>
    );
}