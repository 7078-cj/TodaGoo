
import React, { useState, useRef, useEffect, useCallback } from "react";
import { View } from "react-native";
import { LeafletMapView } from "./LeafletMapView";
import SearchInput from "./SearchInput";
import { initLocation } from "../../utils/mapUtils/initLocation";
import { handleSearch } from "../../utils/mapUtils/handleSearch";
import { fetchOsrmRoutes } from "../../utils/mapUtils/fetchOsrmRoutes";
import { ReverseGeolocation } from "../../utils/mapUtils/reverseGeolocation";
import MapControls from "./MapControls";

export default function MapComponent({
    location = null,
    setLocation,
    markers = [],
    editMode = false,
    userLocation = true,
    user,
    routeSources = [],
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [userLoc, setUserLoc] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState({});
    const mapHandleRef = useRef(null);
    const debounceTimer = useRef(null);
    const lastRequestId = useRef(0);
    const hasInitializedLocation = useRef(false); // 🔒 guard

    // Initialize location ONCE, ever — not on every render/remount
    useEffect(() => {
        if (userLocation && !hasInitializedLocation.current) {
        hasInitializedLocation.current = true;
        initLocation({ location, user, setUserLoc, setLocation }).catch((err) => {
            console.warn("Initial location setup skipped:", err?.message);
        });
        }
    }, [userLocation]);

    useEffect(() => {
        if (location?.lat != null && location?.lng != null) {
        mapHandleRef.current?.recenter({ lat: location.lat, lng: location.lng }, 16);
        }
    }, [location]);

    useEffect(() => {
        if (!routeSources.length) return;
        routeSources.forEach((source) => {
        if (!source.from || !source.to) return;
        fetchOsrmRoutes({
            coordinates: [source.from, source.to],
            setRoutes: (routes) => {
            if (!routes.length) return;
            const converted = routes[0].coordinates.map(([lng, lat]) => ({ lat, lng }));
            setRouteCoordinates((prev) => ({ ...prev, [source.id]: converted }));
            },
        });
        });
    }, [routeSources]);

    const center = location
        ? { lat: location.lat, lng: location.lng }
        : userLoc
        ? { lat: userLoc.lat, lng: userLoc.lng }
        : { lat: 14.949553352698302, lng: 120.75886839058785 };

    const flattenedRoute = Object.values(routeCoordinates)[0] || [];

    const mapMarkers = [
        ...markers
        .filter((m) => m.latitude != null && m.longitude != null)
        .map((m) => ({
            id: m.id,
            lat: m.latitude,
            lng: m.longitude,
            label: m.name,
            type: "default",
        })),
        ...(location?.lat != null && location?.lng != null
        ? [{ id: "current-location", lat: location.lat, lng: location.lng, type: "user" }]
        : []),
    ];

    const handleMapPress = useCallback(
        (coords) => {
        if (!editMode || !setLocation) return;

        setLocation((prev) => ({ ...prev, lat: coords.lat, lng: coords.lng }));

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        const requestId = ++lastRequestId.current;

        debounceTimer.current = setTimeout(async () => {
            try {
            const newLoc = await ReverseGeolocation(coords.lat, coords.lng);
            if (requestId === lastRequestId.current) setLocation(newLoc);
            } catch (err) {
            console.error("Reverse geolocation failed:", err.message);
            if (requestId === lastRequestId.current) {
                setLocation({ lat: coords.lat, lng: coords.lng, city: "", country: "", full: "" });
            }
            }
        }, 600);
        },
        [editMode, setLocation]
    );

    return (
        <View style={{ flex: 1 }}>
        {location && editMode && (
            <SearchInput
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            action={() => handleSearch(searchQuery, setLocation, mapHandleRef)}
            />
        )}

        <LeafletMapView
            ref={mapHandleRef}
            center={center}
            zoom={16}
            markers={mapMarkers}
            route={flattenedRoute}
            editMode={editMode}
            onMapPress={handleMapPress}
            onMarkerPress={(id) => console.log("Marker pressed:", id)}
        />
        <MapControls
            mapRef={mapHandleRef}
            onLocate={(coords) => {
                // optional: drop/update a "user" marker at the new location
                setMarkers((prev) => [
                    ...prev.filter((m) => m.id !== "me"),
                    { id: "me", lat: coords.lat, lng: coords.lng, type: "user" },
                ]);
            }}
        />
        </View>
    );
}