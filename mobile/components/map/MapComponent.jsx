import React, { useState, useRef, useEffect, useCallback } from "react";
import { View } from "react-native";
import { LeafletMapView } from "./LeafletMapView";
import SearchInput from "./SearchInput";
import { initLocation } from "../../utils/mapUtils/initLocation";
import { handleSearch } from "../../utils/mapUtils/handleSearch";
import { fetchOsrmRoutes } from "../../utils/mapUtils/fetchOsrmRoutes";
import { ReverseGeolocation } from "../../utils/mapUtils/reverseGeolocation";
import MapControls from "./MapControls";


function markerTypeFromId(id) {
    if (id === "start") return "start";
    if (id === "end") return "end";
    if (typeof id === "string" && id.startsWith("stop-")) return "stop";
    return "default";
}

export default function MapComponent({
    location = null,
    setLocation,
    markers = [],
    editMode = false,
    userLocation = true,
    user,
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [userLoc, setUserLoc] = useState(null);
    const [route, setRoute] = useState([]);
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

    // Derive the route straight from markers — no routeSources needed.
    // Only fetch when there's more than one marker to connect.
    useEffect(() => {
        const validMarkers = markers.filter((m) => m.lat != null && m.lng != null);

        if (validMarkers.length < 2) {
        setRoute([]);
        return;
        }

        const coordinates = validMarkers.map((m) => ({ lat: m.lat, lng: m.lng }));

        fetchOsrmRoutes({
        coordinates,
        setRoutes: (routes) => {
            if (!routes.length) {
            setRoute([]);
            return;
            }
            const converted = routes[0].coordinates.map(([lng, lat]) => ({ lat, lng }));
            setRoute(converted);
        },
        });
    }, [markers]);

    const center = location
        ? { lat: location.lat, lng: location.lng }
        : userLoc
        ? { lat: userLoc.lat, lng: userLoc.lng }
        : { lat: 14.949553352698302, lng: 120.75886839058785 };

    const mapMarkers = [
        ...markers
        .filter((m) => m.lat != null && m.lng != null)
        .map((m) => ({
            id: m.id,
            lat: m.lat,
            lng: m.lng,
            // book.js passes address text as `full`, not `name` — fall
            // back to it so labels actually show up too.
            label: m.name ?? m.full,
            // Respect an explicit type if one was ever passed in,
            // otherwise recover it from the id ("start"/"end"/"stop-N").
            type: m.type ?? markerTypeFromId(m.id),
        })),
        ...(location?.lat != null && location?.lng != null
        ? [{ id: "current-location", lat: location.lat, lng: location.lng, type: "user" }]
        : []),
        ...(userLoc?.lat != null && userLoc?.lng != null
        ? [{ id: "me", lat: userLoc.lat, lng: userLoc.lng, type: "user" }]
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
            route={route}
            editMode={editMode}
            onMapPress={handleMapPress}
            onMarkerPress={(id) => console.log("Marker pressed:", id)}
        />
        <MapControls
            mapRef={mapHandleRef}
            onLocate={(coords) => setUserLoc(coords)}
        />
        </View>
    );
}