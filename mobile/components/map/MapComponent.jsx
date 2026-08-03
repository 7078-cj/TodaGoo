import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
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

const MapComponent = forwardRef(function MapComponent(
    {
        location = null,
        setLocation,
        markers = [],
        areas = [],
        editMode = false,
        userLocation = true,
        user,
        onAreaPress,
        onMarkerPress,
        centerOnMarkerPress = true,
        centerZoom = 17,
        // NEW: externally-supplied route. When provided (non-empty array),
        // this is drawn as-is and the internal OSRM fetch is skipped
        // entirely — the caller is in full control of what's drawn.
        route: routeProp = null,
        // NEW: toggles the internal marker -> OSRM fetch. Only relevant
        // when routeProp is NOT supplied. Defaults to true so existing
        // callers keep working unchanged.
        isRoute = true,
        // NEW: fires whenever the *effective* route (prop or fetched)
        // changes, so a parent can mirror it into its own state.
        onRouteChange,
    },
    ref
) {
    const [searchQuery, setSearchQuery] = useState("");
    const [userLoc, setUserLoc] = useState(null);
    const [fetchedRoute, setFetchedRoute] = useState([]);
    const mapHandleRef = useRef(null);
    const debounceTimer = useRef(null);
    const lastRequestId = useRef(0);
    const hasInitializedLocation = useRef(false); // 🔒 guard

    // Normalise areas so callers can pass a single item or an array,
    // same convention as `markers`.
    const normalisedAreas = Array.isArray(areas) ? areas : areas ? [areas] : [];

    // Whether the caller has handed us a route directly. An explicit,
    // non-empty array means "draw exactly this" — we don't fetch.
    const hasExternalRoute = Array.isArray(routeProp) && routeProp.length > 0;

    // The route actually drawn on the map: external prop wins if given,
    // otherwise fall back to whatever we fetched internally.
    const route = hasExternalRoute ? routeProp : fetchedRoute;

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
    // Skipped entirely if the caller supplied their own route, or if
    // isRoute is false.
    useEffect(() => {
        if (hasExternalRoute || !isRoute) {
        setFetchedRoute([]);
        return;
        }

        const validMarkers = markers.filter((m) => m.lat != null && m.lng != null);

        if (validMarkers.length < 2) {
        setFetchedRoute([]);
        return;
        }

        const coordinates = validMarkers.map((m) => ({ lat: m.lat, lng: m.lng }));

        fetchOsrmRoutes({
        coordinates,
        setRoutes: (routes) => {
            if (!routes.length) {
            setFetchedRoute([]);
            return;
            }
            const converted = routes[0].coordinates.map(([lng, lat]) => ({ lat, lng }));
            setFetchedRoute(converted);
        },
        });
    }, [markers, isRoute, hasExternalRoute]);

    // Let the parent know whenever the *effective* route changes,
    // whether it came from props or from our own fetch.
    useEffect(() => {
        onRouteChange?.(route);
    }, [route, onRouteChange]);

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

    // Center + zoom on a marker when it's pressed, then still bubble the
    // press up to whatever the caller wants to do with it.
    const handleMarkerPress = useCallback(
        (id) => {
        if (centerOnMarkerPress) {
            mapHandleRef.current?.centerOnMarker(id, centerZoom);
        }
        onMarkerPress?.(id);
        },
        [centerOnMarkerPress, centerZoom, onMarkerPress]
    );

    // Keep a ref mirror of the effective route so getRoute() below never
    // returns a stale closure value.
    const routeRef = useRef(route);
    routeRef.current = route;

    // Expose the underlying map controls to parent components, so a list
    // item, search result, or button outside the map can drive it.
    useImperativeHandle(ref, () => ({
        centerOnMarker(id, zoom) {
            mapHandleRef.current?.centerOnMarker(id, zoom ?? centerZoom);
        },
        recenter(nextCenter, nextZoom) {
            mapHandleRef.current?.recenter(nextCenter, nextZoom);
        },
        fitToContent() {
            mapHandleRef.current?.fitToContent();
        },
        zoomIn() {
            mapHandleRef.current?.zoomIn();
        },
        zoomOut() {
            mapHandleRef.current?.zoomOut();
        },
        // Pull-based access to the currently drawn route (prop or fetched).
        getRoute() {
            return routeRef.current;
        },
    }), [centerZoom]);

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
            areas={normalisedAreas}
            editMode={editMode}
            onMapPress={handleMapPress}
            onMarkerPress={handleMarkerPress}
            onAreaPress={onAreaPress}
        />
        <MapControls
            mapRef={mapHandleRef}
            onLocate={(coords) => setUserLoc(coords)}
        />
        </View>
    );
});

export default MapComponent;