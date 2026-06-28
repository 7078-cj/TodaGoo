import { forwardRef, useImperativeHandle, useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

function buildMapHtml(center, zoom) {
    return `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        html, body, #map { margin:0; padding:0; height:100%; width:100%; }
        .marker-default { background:#919099; width:14px; height:14px; border-radius:50%; border:2px solid #fff; }
        .marker-user { background:#ffc107; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 12px rgba(255,193,7,.8); }
        .marker-destination { background:#e53935; width:16px; height:16px; border-radius:50%; border:2px solid #fff; }
    </style>
    </head>
    <body>
    <div id="map"></div>
    <script>
        function createIcon(m) {
        var type = m.type || 'default';
        var cls = 'marker-' + type;
        var size = type === 'user' ? 18 : type === 'destination' ? 16 : 14;
        return L.divIcon({
            className: '',
            html: '<div class="' + cls + '"></div>',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
        }

        const map = L.map('map', { zoomControl: false, minZoom: 3, maxZoom: 19 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        }).addTo(map);

        map.setView([${center.lat}, ${center.lng}], ${zoom});

        window.leafletMap = map;
        window.markersLayer = L.layerGroup().addTo(map);
        window.routeLayer = L.layerGroup().addTo(map);
        window.editModeEnabled = false;

        window.mapZoomIn = function() { map.zoomIn(); };
        window.mapZoomOut = function() { map.zoomOut(); };

        window.mapRecenter = function(lat, lng, zoomLevel) {
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        map.flyTo([lat, lng], typeof zoomLevel === 'number' ? zoomLevel : map.getZoom(), { duration: 1.2 });
        };

        // Replace markers without reloading the map
        window.setMarkers = function(markers) {
        window.markersLayer.clearLayers();
        (markers || []).forEach(function(m) {
            const marker = L.marker([m.lat, m.lng], { icon: createIcon(m) });
            marker.on('click', function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
                JSON.stringify({ type: 'markerPress', id: m.id })
            );
            });
            marker.addTo(window.markersLayer);
        });
        };

        // Replace route polyline without reloading the map
        window.setRoute = function(route, fit) {
        window.routeLayer.clearLayers();
        if (route && route.length > 1) {
            const line = L.polyline(
            route.map(function(p) { return [p.lat, p.lng]; }),
            { color: '#4285F4', weight: 4, opacity: 0.8 }
            );
            line.addTo(window.routeLayer);
            if (fit) map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 16 });
        }
        };

        window.setEditMode = function(enabled) {
        window.editModeEnabled = !!enabled;
        };

        window.mapFitContent = function() {
        var bounds = [];
        window.markersLayer.eachLayer(function(l) { bounds.push(l.getLatLng()); });
        window.routeLayer.eachLayer(function(l) {
            if (l.getLatLngs) bounds = bounds.concat(l.getLatLngs());
        });
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        else if (bounds.length === 1) map.setView(bounds[0], 15);
        };

        map.on('click', function (e) {
        if (!window.editModeEnabled) return;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'mapPress', lat: e.latlng.lat, lng: e.latlng.lng })
        );
        });

        setTimeout(function() { map.invalidateSize(); }, 100);
    </script>
    </body>
    </html>`;
}

export const LeafletMapView = forwardRef(function LeafletMapView(
    { center, zoom = 14, markers = [], route = [], editMode = false, onMarkerPress, onMapPress },
    ref,
) {
    const webViewRef = useRef(null);
    const centerRef = useRef(center);
    const zoomRef = useRef(zoom);
    const isReadyRef = useRef(false);
    centerRef.current = center;
    zoomRef.current = zoom;

    // Build HTML only ONCE on mount — never rebuilt on prop changes
    const initialHtmlRef = useRef(buildMapHtml(center, zoom));

    const inject = (script) => {
        webViewRef.current?.injectJavaScript(`${script}; true;`);
    };

    // Push marker updates into the existing map instance (no reload)
    useEffect(() => {
        if (!isReadyRef.current) return;
        inject(`window.setMarkers && window.setMarkers(${JSON.stringify(markers)})`);
    }, [markers]);

    // Push route updates into the existing map instance (no reload)
    useEffect(() => {
        if (!isReadyRef.current) return;
        inject(`window.setRoute && window.setRoute(${JSON.stringify(route)}, ${route.length > 1})`);
    }, [route]);

    // Push edit mode toggle
    useEffect(() => {
        if (!isReadyRef.current) return;
        inject(`window.setEditMode && window.setEditMode(${editMode})`);
    }, [editMode]);

    useImperativeHandle(ref, () => ({
        zoomIn: () => inject("window.mapZoomIn && window.mapZoomIn()"),
        zoomOut: () => inject("window.mapZoomOut && window.mapZoomOut()"),
        recenter: (nextCenter, nextZoom) => {
        const c = nextCenter ?? centerRef.current;
        const z = nextZoom ?? zoomRef.current;
        inject(`window.mapRecenter && window.mapRecenter(${c.lat}, ${c.lng}, ${z})`);
        },
        fitToContent: () => inject("window.mapFitContent && window.mapFitContent()"),
    }), []);

    return (
        <View style={{ flex: 1, overflow: "hidden", borderRadius: 16 }}>
        <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: initialHtmlRef.current }}
            javaScriptEnabled
            domStorageEnabled
            style={{ flex: 1 }}
            onLoadEnd={() => {
            isReadyRef.current = true;
            // Push initial state once the map has loaded
            inject(`window.setMarkers && window.setMarkers(${JSON.stringify(markers)})`);
            inject(`window.setRoute && window.setRoute(${JSON.stringify(route)}, ${route.length > 1})`);
            inject(`window.setEditMode && window.setEditMode(${editMode})`);
            }}
            onMessage={(event) => {
            try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "markerPress" && onMarkerPress) onMarkerPress(data.id);
                if (data.type === "mapPress" && onMapPress) onMapPress({ lat: data.lat, lng: data.lng });
            } catch {
                // ignore malformed messages
            }
            }}
        />
        </View>
    );
});