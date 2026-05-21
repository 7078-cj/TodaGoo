import React, { useState, useRef, useEffect, useCallback } from "react";
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

// ---------------------------------------------------------------------------
// AreaLayers – inner component that consumes the MapLibre map instance via
// the useMap() hook (same pattern as the documentation example).
// ---------------------------------------------------------------------------
function AreaLayers({ areas }) {
    const { map, isLoaded } = useMap();
    const [hoveredArea, setHoveredArea] = useState(null);
    const registeredIds = useRef(new Set());

    const normalisedAreas = areas
        .map((a, i) => normaliseArea(a, i))
        .filter(Boolean);

    // Build / update layers whenever the map is ready or areas change
    useEffect(() => {
        if (!map || !isLoaded || !normalisedAreas.length) return;

        const newIds = new Set();

        normalisedAreas.forEach(({ id, color, fillOpacity, lineOpacity, lineWidth, feature }) => {
            const sourceId = `area-source-${id}`;
            const fillId = `area-fill-${id}`;
            const lineId = `area-line-${id}`;

            newIds.add(fillId);
            newIds.add(lineId);

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

        // Remove stale layers that are no longer in the areas list
        registeredIds.current.forEach((layerId) => {
            if (!newIds.has(layerId) && map.getLayer(layerId)) {
                map.removeLayer(layerId);
            }
        });

        registeredIds.current = newIds;
    }, [map, isLoaded, JSON.stringify(normalisedAreas)]);

    // Hover interactions
    useEffect(() => {
        if (!map || !isLoaded || !normalisedAreas.length) return;

        const fillLayerIds = normalisedAreas.map(({ id }) => `area-fill-${id}`);

        const handleMouseMove = (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: fillLayerIds });
            if (features.length > 0) {
                map.getCanvas().style.cursor = "pointer";
                // Find matching area label
                const hitLayerId = features[0].layer.id;
                const hitId = hitLayerId.replace("area-fill-", "");
                const match = normalisedAreas.find((a) => a.id === hitId);
                setHoveredArea(match?.label ?? null);
            } else {
                map.getCanvas().style.cursor = "";
                setHoveredArea(null);
            }
        };

        const handleMouseLeave = () => {
            map.getCanvas().style.cursor = "";
            setHoveredArea(null);
        };

        map.on("mousemove", handleMouseMove);
        map.on("mouseout", handleMouseLeave);

        return () => {
            map.off("mousemove", handleMouseMove);
            map.off("mouseout", handleMouseLeave);
        };
    }, [map, isLoaded, normalisedAreas]);

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
            normalisedAreas.forEach(({ id }) => {
                const fillId = `area-fill-${id}`;
                const lineId = `area-line-${id}`;
                const sourceId = `area-source-${id}`;
                try { if (map.getLayer(fillId)) map.removeLayer(fillId); } catch { /* already gone */ }
                try { if (map.getLayer(lineId)) map.removeLayer(lineId); } catch { /* already gone */ }
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

                {/* Polygon / GeoJSON area overlays */}
                {normalisedAreasProp.length > 0 && (
                    <AreaLayers areas={normalisedAreasProp} />
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