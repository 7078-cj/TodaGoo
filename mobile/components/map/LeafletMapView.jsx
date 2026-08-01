import { forwardRef, useImperativeHandle, useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";


function safeJSONStringify(value) {
    return JSON.stringify(value ?? null).replace(/</g, "\\u003c");
}

function buildMapHtml(center, zoom) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />

<link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<style>

html,
body,
#map {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: #e5e3df;
}

/* ============================
   Google Maps-style Pin Markers
============================ */

.marker-wrap {
    width: 34px;
    height: 44px;
    position: relative;
    animation: pin-drop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: bottom center;
}

@keyframes pin-drop {
    0% {
        transform: translateY(-24px) scale(0.6);
        opacity: 0;
    }
    60% {
        transform: translateY(2px) scale(1.05);
        opacity: 1;
    }
    100% {
        transform: translateY(0) scale(1);
        opacity: 1;
    }
}

.marker-pin {
    width: 34px;
    height: 34px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    position: absolute;
    top: 0;
    left: 0;
    border: 2.5px solid #fff;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.marker-pin-inner {
    transform: rotate(45deg);
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
    user-select: none;
}

.marker-shadow {
    position: absolute;
    bottom: -2px;
    left: 50%;
    width: 16px;
    height: 6px;
    background: rgba(0, 0, 0, 0.28);
    border-radius: 50%;
    transform: translateX(-50%);
    filter: blur(1px);
}

.marker-wrap:active .marker-pin,
.marker-wrap.pressed .marker-pin {
    transform: rotate(-45deg) scale(0.9);
}

/* Marker color themes */

.marker-start { background: #22c55e; }
.marker-stop  { background: #f59e0b; }
.marker-end   { background: #ef4444; }
.marker-user  { background: #2563eb; }
.marker-driver{ background: #7c3aed; }
.marker-default{ background: #6b7280; }

/* Subtle pulse ring for the "user" marker, like Google Maps' blue dot */

.marker-user::before {
    content: "";
}

.pulse-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 34px;
    height: 34px;
    margin: -17px 0 0 -17px;
    border-radius: 50%;
    background: rgba(37, 99, 235, 0.35);
    animation: pulse 1.8s ease-out infinite;
    pointer-events: none;
}

@keyframes pulse {
    0%   { transform: scale(0.6); opacity: 0.8; }
    100% { transform: scale(2.2); opacity: 0; }
}

/* Tooltips / labels */

.leaflet-tooltip.marker-label,
.leaflet-tooltip.area-label {
    border: none;
    border-radius: 8px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
    color: #1f2937;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.leaflet-tooltip.marker-label::before,
.leaflet-tooltip.area-label::before {
    border-top-color: #fff;
}

/* Route polyline animation (dash flow) */

.route-line {
    stroke-dasharray: 1 0;
    transition: d 0.3s ease;
}

.leaflet-control-attribution {
    font-size: 9px;
}

</style>

</head>

<body>

<div id="map"></div>

<script>

const MARKER_THEMES = {
    start:   { className: "marker-start",   text: "S" },
    stop:    { className: "marker-stop",    text: "" },
    end:     { className: "marker-end",     text: "E" },
    user:    { className: "marker-user",    text: "" },
    driver:  { className: "marker-driver",  text: "\\uD83D\\uDE97" },
    default: { className: "marker-default", text: "" }
};

function createIcon(marker) {

    const theme = MARKER_THEMES[marker.type] || MARKER_THEMES.default;

    const pulse = marker.type === "user"
        ? '<div class="pulse-ring"></div>'
        : "";

    const html =
        '<div class="marker-wrap">' +
            pulse +
            '<div class="marker-pin ' + theme.className + '">' +
                '<div class="marker-pin-inner">' + theme.text + '</div>' +
            '</div>' +
            '<div class="marker-shadow"></div>' +
        '</div>';

    return L.divIcon({
        className: "",
        html: html,
        iconSize: [34, 44],
        iconAnchor: [17, 40],
        popupAnchor: [0, -36]
    });

}

/* ============================
   Area / Polygon normalisation
   Accepted shapes per area entry:
     • Raw ring:        [[lng,lat], [lng,lat], ...]
     • Array of rings:  [[[lng,lat],...], [[lng,lat],...]]  (holes)
     • GeoJSON Feature: { type:"Feature", geometry:{...}, properties:{...} }
     • GeoJSON Geometry:{ type:"Polygon"|"MultiPolygon", coordinates:[...] }
     • Structured:       { id, label, color, fillOpacity, lineWidth, coordinates }
============================ */

const AREA_COLORS = [
    "#4285F4", "#EA4335", "#FBBC05", "#34A853",
    "#FF6D00", "#7B1FA2", "#0288D1", "#00796B"
];

function ringToLatLngs(ring) {
    // GeoJSON rings are [lng, lat]; Leaflet wants [lat, lng]
    return ring.map(function (pt) { return [pt[1], pt[0]]; });
}

function coordsToLatLngs(coordinates, geomType) {
    if (geomType === "MultiPolygon") {
        // coordinates: Polygon[][] -> [[ring, ring...], [ring, ring...]]
        return coordinates.map(function (polygon) {
            return polygon.map(ringToLatLngs);
        });
    }
    // Polygon: coordinates -> [ring, ring...] (first = outer, rest = holes)
    return coordinates.map(ringToLatLngs);
}

function normaliseArea(area, index) {

    if (area && area.type === "Feature") {
        const geom = area.geometry || {};
        return {
            id: String(area.id != null ? area.id : "area-" + index),
            label: (area.properties && (area.properties.name || area.properties.label)) || "Area " + (index + 1),
            color: (area.properties && area.properties.color) || AREA_COLORS[index % AREA_COLORS.length],
            fillOpacity: (area.properties && area.properties.fillOpacity != null) ? area.properties.fillOpacity : 0.25,
            lineOpacity: (area.properties && area.properties.lineOpacity != null) ? area.properties.lineOpacity : 0.85,
            lineWidth: (area.properties && area.properties.lineWidth) || 2,
            latlngs: coordsToLatLngs(geom.coordinates, geom.type),
            multi: geom.type === "MultiPolygon"
        };
    }

    if (area && (area.type === "Polygon" || area.type === "MultiPolygon")) {
        return {
            id: "area-" + index,
            label: "Area " + (index + 1),
            color: AREA_COLORS[index % AREA_COLORS.length],
            fillOpacity: 0.25,
            lineOpacity: 0.85,
            lineWidth: 2,
            latlngs: coordsToLatLngs(area.coordinates, area.type),
            multi: area.type === "MultiPolygon"
        };
    }

    if (Array.isArray(area)) {
        const firstItem = area[0];
        let rings;
        if (Array.isArray(firstItem) && Array.isArray(firstItem[0])) {
            rings = area; // already an array of rings
        } else {
            rings = [area]; // single ring
        }
        // Auto-close each ring if needed
        rings = rings.map(function (ring) {
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                return ring.concat([first]);
            }
            return ring;
        });

        return {
            id: "area-" + index,
            label: "Area " + (index + 1),
            color: AREA_COLORS[index % AREA_COLORS.length],
            fillOpacity: 0.25,
            lineOpacity: 0.85,
            lineWidth: 2,
            latlngs: coordsToLatLngs(rings, "Polygon"),
            multi: false
        };
    }

    if (area && area.coordinates) {
        const base = normaliseArea(area.coordinates, index);
        return Object.assign({}, base, {
            id: area.id != null ? String(area.id) : base.id,
            label: area.label || area.name || base.label,
            color: area.color || base.color,
            fillOpacity: area.fillOpacity != null ? area.fillOpacity : base.fillOpacity,
            lineOpacity: area.lineOpacity != null ? area.lineOpacity : base.lineOpacity,
            lineWidth: area.lineWidth || base.lineWidth
        });
    }

    return null;
}

/* ============================
   Map init
============================ */

const map = L.map("map", {
    zoomControl: false,
    minZoom: 3,
    maxZoom: 19,
    fadeAnimation: true,
    zoomAnimation: true,
    markerZoomAnimation: true
});

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19
    }
).addTo(map);

map.setView([${center.lat}, ${center.lng}], ${zoom});

/* Layers */

window.markersLayer = L.layerGroup().addTo(map);
window.routeLayer = L.layerGroup().addTo(map);
window.areasLayer = L.layerGroup().addTo(map);
window.markerRefs = {};
window.areaRefs = {};
window.editModeEnabled = false;

/* ============================
   Zoom
============================ */

window.mapZoomIn = function () {
    map.zoomIn();
};

window.mapZoomOut = function () {
    map.zoomOut();
};

/* ============================
   Recenter
============================ */

window.mapRecenter = function (lat, lng, zoom) {
    map.flyTo(
        [lat, lng],
        zoom || map.getZoom(),
        { duration: 1.2 }
    );
};

/* ============================
   Center on a specific marker by id
============================ */

window.centerOnMarker = function (id, zoom) {
    const marker = window.markerRefs[String(id)];
    if (!marker) {
        console.log("centerOnMarker: no marker found for id", id);
        return;
    }
    const latLng = marker.getLatLng();
    map.flyTo(
        [latLng.lat, latLng.lng],
        zoom || Math.max(map.getZoom(), 16),
        { duration: 1.2 }
    );
};

/* ============================
   Markers (diffed, no full reload)
============================ */

window.setMarkers = function (markers) {

    const next = markers || [];
    const nextIds = new Set(next.map(function (m) { return String(m.id); }));

    // Remove markers that no longer exist
    Object.keys(window.markerRefs).forEach(function (id) {
        if (!nextIds.has(id)) {
            window.markersLayer.removeLayer(window.markerRefs[id]);
            delete window.markerRefs[id];
        }
    });

    next.forEach(function (marker) {

        const id = String(marker.id);
        const existing = window.markerRefs[id];

        if (existing) {
            // Update position/icon in place instead of recreating,
            // so unrelated markers never flicker or re-animate.
            const latLng = existing.getLatLng();
            if (latLng.lat !== marker.lat || latLng.lng !== marker.lng) {
                existing.setLatLng([marker.lat, marker.lng]);
            }
            if (existing._markerType !== marker.type) {
                existing.setIcon(createIcon(marker));
                existing._markerType = marker.type;
            }
            if (marker.label) {
                existing.unbindTooltip();
                existing.bindTooltip(marker.label, {
                    direction: "top",
                    offset: [0, -34],
                    className: "marker-label"
                });
            }
            return;
        }

        const leafletMarker = L.marker(
            [marker.lat, marker.lng],
            { icon: createIcon(marker) }
        );

        leafletMarker._markerType = marker.type;

        if (marker.label) {
            leafletMarker.bindTooltip(marker.label, {
                direction: "top",
                offset: [0, -34],
                className: "marker-label"
            });
        }

        leafletMarker.on("click", function () {
            window.ReactNativeWebView.postMessage(
                JSON.stringify({ type: "markerPress", id: marker.id })
            );
        });

        leafletMarker.addTo(window.markersLayer);
        window.markerRefs[id] = leafletMarker;

    });

};

/* ============================
   Areas / Polygons (diffed)
============================ */

window.setAreas = function (rawAreas) {

    const list = (rawAreas || [])
        .map(function (a, i) { return normaliseArea(a, i); })
        .filter(Boolean);

    const nextIds = new Set(list.map(function (a) { return a.id; }));

    // Remove stale polygons
    Object.keys(window.areaRefs).forEach(function (id) {
        if (!nextIds.has(id)) {
            window.areasLayer.removeLayer(window.areaRefs[id]);
            delete window.areaRefs[id];
        }
    });

    list.forEach(function (a) {

        const existing = window.areaRefs[a.id];

        if (existing) {
            existing.setLatLngs(a.latlngs);
            existing.setStyle({
                color: a.color,
                weight: a.lineWidth,
                opacity: a.lineOpacity,
                fillColor: a.color,
                fillOpacity: a.fillOpacity
            });
            existing.unbindTooltip();
            if (a.label) {
                existing.bindTooltip(a.label, {
                    sticky: true,
                    direction: "top",
                    className: "area-label"
                });
            }
            return;
        }

        const polygon = L.polygon(a.latlngs, {
            color: a.color,
            weight: a.lineWidth,
            opacity: a.lineOpacity,
            fillColor: a.color,
            fillOpacity: a.fillOpacity
        });

        if (a.label) {
            polygon.bindTooltip(a.label, {
                sticky: true,
                direction: "top",
                className: "area-label"
            });
        }

        polygon.on("click", function () {
            window.ReactNativeWebView.postMessage(
                JSON.stringify({ type: "areaPress", id: a.id })
            );
        });

        polygon.addTo(window.areasLayer);
        window.areaRefs[a.id] = polygon;

    });

};

/* ============================
   Route
============================ */

window.routePolyline = null;

window.setRoute = function (route, fit) {

    if (!route || route.length < 2) {
        window.routeLayer.clearLayers();
        window.routePolyline = null;
        return;
    }

    const latLngs = route.map(function (point) {
        return [point.lat, point.lng];
    });

    if (window.routePolyline) {
        window.routePolyline.setLatLngs(latLngs);
    } else {
        window.routePolyline = L.polyline(latLngs, {
            color: "#2563eb",
            weight: 5,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
            className: "route-line"
        });
        window.routePolyline.addTo(window.routeLayer);
    }

    if (fit) {
        map.fitBounds(window.routePolyline.getBounds(), {
            padding: [40, 40],
            maxZoom: 16
        });
    }

};

/* ============================
   Edit Mode
============================ */

window.setEditMode = function (enabled) {
    window.editModeEnabled = !!enabled;
};

/* ============================
   Fit Contents
============================ */

window.mapFitContent = function () {

    let bounds = [];

    window.markersLayer.eachLayer(function (layer) {
        bounds.push(layer.getLatLng());
    });

    window.areasLayer.eachLayer(function (layer) {
        if (layer.getBounds) {
            bounds.push(layer.getBounds());
        }
    });

    if (window.routePolyline) {
        bounds = bounds.concat(window.routePolyline.getLatLngs());
    }

    if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
        map.setView(bounds[0].getCenter ? bounds[0].getCenter() : bounds[0], 16);
    }

};

/* ============================
   Map Click
============================ */

map.on("click", function (e) {

    if (!window.editModeEnabled) return;

    window.ReactNativeWebView.postMessage(
        JSON.stringify({
            type: "mapPress",
            lat: e.latlng.lat,
            lng: e.latlng.lng
        })
    );

});

setTimeout(function () {
    map.invalidateSize();
}, 100);

window.ReactNativeWebView.postMessage(JSON.stringify({ type: "mapReady" }));

</script>

</body>

</html>`;

}

export const LeafletMapView = forwardRef(function LeafletMapView(
    {
        center,
        zoom = 16,
        markers = [],
        route = [],
        areas = [],
        editMode = false,
        onMarkerPress,
        onAreaPress,
        onMapPress
    },
    ref
) {

    const webViewRef = useRef(null);
    const readyRef = useRef(false);
    const pendingActionsRef = useRef([]);

    const centerRef = useRef(center);
    const zoomRef = useRef(zoom);
    centerRef.current = center;
    zoomRef.current = zoom;

    // HTML is built once per mount; center/zoom updates after that go
    // through mapRecenter, not a WebView reload, so the map never flashes.
    const htmlRef = useRef(buildMapHtml(center, zoom));

    const inject = (script) => {
        if (!readyRef.current) {
            // Queue actions requested before the WebView finished loading
            // (e.g. an imperative ref call fired on mount) instead of
            // silently dropping them.
            pendingActionsRef.current.push(script);
            return;
        }
        webViewRef.current?.injectJavaScript(`${script};true;`);
    };

    const flushPending = () => {
        const queued = pendingActionsRef.current;
        pendingActionsRef.current = [];
        queued.forEach((script) => {
            webViewRef.current?.injectJavaScript(`${script};true;`);
        });
    };

    useEffect(() => {
        if (!readyRef.current) return;
        inject(`window.setMarkers(${safeJSONStringify(markers)})`);
    }, [markers]);

    useEffect(() => {
        if (!readyRef.current) return;
        inject(`window.setRoute(${safeJSONStringify(route)}, ${route.length > 1})`);
    }, [route]);

    useEffect(() => {
        if (!readyRef.current) return;
        inject(`window.setAreas(${safeJSONStringify(areas)})`);
    }, [areas]);

    useEffect(() => {
        if (!readyRef.current) return;
        inject(`window.setEditMode(${!!editMode})`);
    }, [editMode]);

    useImperativeHandle(ref, () => ({

        zoomIn() {
            inject("window.mapZoomIn()");
        },

        zoomOut() {
            inject("window.mapZoomOut()");
        },

        recenter(nextCenter, nextZoom) {
            const c = nextCenter ?? centerRef.current;
            const z = nextZoom ?? zoomRef.current;
            inject(`window.mapRecenter(${c.lat}, ${c.lng}, ${z})`);
        },

        centerOnMarker(id, zoom) {
            const safeId = JSON.stringify(String(id));
            inject(`window.centerOnMarker(${safeId}, ${zoom ?? "undefined"})`);
        },

        fitToContent() {
            inject("window.mapFitContent()");
        }

    }), []);

    return (
        <View
            style={{
                flex: 1,
                overflow: "hidden",
                borderRadius: 16
            }}
        >

            <WebView
                ref={webViewRef}
                originWhitelist={["*"]}
                source={{ html: htmlRef.current }}
                javaScriptEnabled
                domStorageEnabled
                style={{ flex: 1 }}
                onLoadEnd={() => {
                    // Wait for the "mapReady" message rather than assuming
                    // onLoadEnd means Leaflet has finished initializing.
                }}
                onMessage={(event) => {

                    try {

                        const data = JSON.parse(event.nativeEvent.data);

                        if (data.type === "mapReady") {
                            readyRef.current = true;
                            inject(`window.setMarkers(${safeJSONStringify(markers)})`);
                            inject(`window.setRoute(${safeJSONStringify(route)}, ${route.length > 1})`);
                            inject(`window.setAreas(${safeJSONStringify(areas)})`);
                            inject(`window.setEditMode(${!!editMode})`);
                            flushPending();
                            return;
                        }

                        if (data.type === "markerPress") {
                            onMarkerPress?.(data.id);
                        }

                        if (data.type === "areaPress") {
                            onAreaPress?.(data.id);
                        }

                        if (data.type === "mapPress") {
                            onMapPress?.({ lat: data.lat, lng: data.lng });
                        }

                    } catch (e) {
                        console.log(e);
                    }

                }}
            />

        </View>
    );

});