import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    useMemo,
    forwardRef,
    useImperativeHandle,
} from "react";
import { View } from "react-native";
import { LeafletMapView } from "./LeafletMapView";
import SearchInput from "./SearchInput";
import { initLocation } from "../../utils/mapUtils/initLocation";
import { handleSearch } from "../../utils/mapUtils/handleSearch";
import { fetchOsrmRoutes } from "../../utils/mapUtils/fetchOsrmRoutes";
import { ReverseGeolocation } from "../../utils/mapUtils/reverseGeolocation";
import MapControls from "./MapControls";

const EMPTY = [];
const DEFAULT_CENTER = { lat: 14.949553352698302, lng: 120.75886839058785 };

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
        markers = EMPTY,
        areas = EMPTY,
        editMode = false,
        userLocation = true,
        // false = the user can't drag / pinch / double-tap zoom the map.
        canHover = true,
        user,
        onAreaPress,
        onMarkerPress,
        centerOnMarkerPress = true,
        centerZoom = 17,
        route: routeProp = null,
        isRoute = true,
        onRouteChange,
    },
    ref
) {
    const [searchQuery, setSearchQuery] = useState("");
    const [userLoc, setUserLoc] = useState(null);
    const [fetchedRoute, setFetchedRoute] = useState(EMPTY);
    const mapHandleRef = useRef(null);
    const debounceTimer = useRef(null);
    const lastRequestId = useRef(0);
    const hasInitializedLocation = useRef(false);
    const hasSyncedUserLoc = useRef(false);

    // `location={{}}` is truthy, so always check the coordinates themselves.
    const hasLocation = location?.lat != null && location?.lng != null;

    // In edit mode the editable `location` is THE marker. The raw GPS
    // marker is only shown when we're not editing.
    const showUserMarker = !!userLoc && !editMode;

    const normalisedAreas = useMemo(
        () => (Array.isArray(areas) ? areas : areas ? [areas] : EMPTY),
        [areas]
    );

    const hasExternalRoute = Array.isArray(routeProp) && routeProp.length > 0;
    const route = hasExternalRoute ? routeProp : fetchedRoute;

    // Sets the pin immediately, then fills in city/address (debounced,
    // with stale-response protection). Used by map taps, the locate
    // button, and the initial user-location sync.
    const pickLocation = useCallback(
        (coords) => {
            if (!setLocation) return;

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
                        setLocation({
                            lat: coords.lat,
                            lng: coords.lng,
                            city: "",
                            country: "",
                            full: "",
                        });
                    }
                }
            }, 600);
        },
        [setLocation]
    );

    // Initialize location ONCE.
    useEffect(() => {
        if (userLocation && !hasInitializedLocation.current) {
            hasInitializedLocation.current = true;
            initLocation({ location, user, setUserLoc, setLocation }).catch((err) => {
                console.warn("Initial location setup skipped:", err?.message);
            });
        }
    }, [userLocation]);

    // Edit mode + userLocation: once the user's position is known and no
    // location has been set yet, make it the editable location.
    useEffect(() => {
        if (
            userLocation &&
            editMode &&
            userLoc &&
            !hasLocation &&
            !hasSyncedUserLoc.current
        ) {
            hasSyncedUserLoc.current = true;
            pickLocation({ lat: userLoc.lat, lng: userLoc.lng });
        }
    }, [userLocation, editMode, userLoc, hasLocation, pickLocation]);

    // Viewing mode + userLocation: center on the user.
    useEffect(() => {
        if (userLocation && !editMode && userLoc) {
            mapHandleRef.current?.recenter({ lat: userLoc.lat, lng: userLoc.lng }, 16);
        }
    }, [userLocation, editMode, userLoc]);

    // Follow `location` changes (edit mode, or when not centering on the user).
    useEffect(() => {
        if (userLocation && !editMode) return; // user centering wins
        if (hasLocation) {
            mapHandleRef.current?.recenter({ lat: location.lat, lng: location.lng }, 16);
        }
    }, [location, userLocation, editMode, hasLocation]);

    // Route from markers.
    useEffect(() => {
        const clearRoute = () =>
            setFetchedRoute((prev) => (prev.length === 0 ? prev : EMPTY));

        if (hasExternalRoute || !isRoute) {
            clearRoute();
            return;
        }

        const validMarkers = markers.filter((m) => m.lat != null && m.lng != null);

        if (validMarkers.length < 2) {
            clearRoute();
            return;
        }

        const coordinates = validMarkers.map((m) => ({ lat: m.lat, lng: m.lng }));
        let cancelled = false;

        fetchOsrmRoutes({
            coordinates,
            setRoutes: (routes) => {
                if (cancelled) return;
                if (!routes.length) {
                    clearRoute();
                    return;
                }
                const converted = routes[0].coordinates.map(([lng, lat]) => ({ lat, lng }));
                setFetchedRoute(converted);
            },
        });

        return () => {
            cancelled = true;
        };
    }, [markers, isRoute, hasExternalRoute]);

    const onRouteChangeRef = useRef(onRouteChange);
    onRouteChangeRef.current = onRouteChange;

    useEffect(() => {
        onRouteChangeRef.current?.(route);
    }, [route]);

    // Initial center: user's position when userLocation is on (viewing),
    // otherwise the editable location, then the user, then the default.
    const center =
        userLocation && !editMode && userLoc
            ? { lat: userLoc.lat, lng: userLoc.lng }
            : hasLocation
            ? { lat: location.lat, lng: location.lng }
            : userLoc
            ? { lat: userLoc.lat, lng: userLoc.lng }
            : DEFAULT_CENTER;

    const mapMarkers = [
        ...markers
            .filter((m) => m.lat != null && m.lng != null)
            .map((m) => ({
                id: m.id,
                lat: m.lat,
                lng: m.lng,
                label: m.name ?? m.full,
                type: m.type ?? markerTypeFromId(m.id),
            })),
        // The editable / selected location.
        ...(hasLocation
            ? [{ id: "current-location", lat: location.lat, lng: location.lng, type: "user" }]
            : []),
        // Raw GPS marker, hidden in edit mode so there's only one pin.
        ...(showUserMarker
            ? [{ id: "me", lat: userLoc.lat, lng: userLoc.lng, type: "user" }]
            : []),
    ];

    const handleMapPress = useCallback(
        (coords) => {
            if (!editMode) return;
            pickLocation(coords);
        },
        [editMode, pickLocation]
    );

    // Locate button: in edit mode it moves the editable pin,
    // otherwise it just updates the user marker.
    const handleLocate = useCallback(
        (coords) => {
            if (editMode && setLocation) {
                pickLocation(coords);
            } else {
                setUserLoc(coords);
            }
        },
        [editMode, setLocation, pickLocation]
    );

    const handleMarkerPress = useCallback(
        (id) => {
            if (centerOnMarkerPress) {
                mapHandleRef.current?.centerOnMarker(id, centerZoom);
            }
            onMarkerPress?.(id);
        },
        [centerOnMarkerPress, centerZoom, onMarkerPress]
    );

    const routeRef = useRef(route);
    routeRef.current = route;

    useImperativeHandle(
        ref,
        () => ({
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
            getRoute() {
                return routeRef.current;
            },
        }),
        [centerZoom]
    );

    return (
        <View style={{ flex: 1 }}>
            {hasLocation && editMode && (
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
                canHover={canHover}
                onMapPress={handleMapPress}
                onMarkerPress={handleMarkerPress}
                onAreaPress={onAreaPress}
            />
            <MapControls mapRef={mapHandleRef} onLocate={handleLocate} />
        </View>
    );
});

export default MapComponent;