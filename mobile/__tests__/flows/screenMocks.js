// jest.mock factories for rendering the real screens in the flow tests:
//   jest.mock("expo-router", () => require("./screenMocks").expoRouter);   (and the others below)
// Only what can't run under Jest is replaced: navigation (no native navigator), the Leaflet map
// (a WebView), GPS, the photo library / camera and the background tasks. Screens, components,
// contexts, listeners and API calls are the app's own.
const React = require("react");
const { View, Text, TouchableOpacity } = require("react-native");

// ---- expo-router: a tiny navigator. Screens call router.push / replace / dismissTo as usual, and
// <TestApp> (appHarness.js) renders the screen for the current path. ----
const nav = { path: "/", history: [], listeners: new Set(), log: [] };
const toPath = (to) => (typeof to === "string" ? to : to?.pathname ?? "/");
function go(kind, to, keepHistory) {
    const path = toPath(to);
    if (keepHistory) nav.history.push(nav.path);
    nav.log.push({ kind, path });
    nav.path = path;
    nav.listeners.forEach((l) => l());
}
const router = {
    push: jest.fn((to) => go("push", to, true)),
    navigate: jest.fn((to) => go("navigate", to, true)),
    replace: jest.fn((to) => go("replace", to, false)),
    dismissTo: jest.fn((to) => go("dismissTo", to, false)),
    back: jest.fn(() => go("back", nav.history.pop() ?? "/", false)),
    canGoBack: jest.fn(() => nav.history.length > 0),
    setParams: jest.fn(),
};
const navigation = {
    reset(path = "/") {
        nav.path = path;
        nav.history = [];
        nav.log = [];
        Object.values(router).forEach((fn) => fn.mockClear?.());
    },
    get path() {
        return nav.path;
    },
    // ["push /(protected)/otp", "replace /(protected)/passenger/home", ...]
    get log() {
        return nav.log.map((e) => `${e.kind} ${e.path}`);
    },
    subscribe(listener) {
        nav.listeners.add(listener);
        return () => nav.listeners.delete(listener);
    },
};
const usePath = () => React.useSyncExternalStore(navigation.subscribe, () => nav.path);
const navigationRef = { isReady: () => true, getRootState: () => ({ routes: [] }) };

const expoRouter = {
    router,
    useRouter: () => router,
    useNavigationContainerRef: () => navigationRef,
    useRootNavigationState: () => navigationRef.getRootState(),
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
    usePathname: () => usePath(),
    useSegments: () => usePath().split("/").filter(Boolean),
    // the screen is focused while it's mounted
    useFocusEffect: (effect) => React.useEffect(() => effect(), [effect]),
    useIsFocused: () => true,
    Stack: Object.assign(({ children }) => children ?? null, { Screen: () => null }),
    Link: ({ children }) => children,
    Redirect: () => null,
};

// ---- the Leaflet map (a WebView): a placeholder that shows the markers it was given. In pick mode
// (the location picker passes setLocation) it has a "map-pick" button that drops the pin on
// map.nextPick, like tapping the map. ----
const map = { nextPick: null, nextRoute: [] };
const MapComponent = React.forwardRef(function MapComponent(props, _ref) {
    const markers = (props.markers ?? []).map((m) => m.full ?? m.name ?? m.id).join(" · ");
    return React.createElement(
        View,
        { testID: "map" },
        React.createElement(Text, { testID: "map-markers" }, markers),
        props.setLocation
            ? React.createElement(TouchableOpacity, {
                  testID: "map-pick",
                  onPress: () => {
                      props.setLocation({ ...map.nextPick });
                      props.onRouteChange?.(map.nextRoute);
                  },
              })
            : null
    );
});
const mapComponent = { __esModule: true, default: MapComponent };

// ---- GPS: the phone is wherever the test puts it ----
let position = { latitude: 14.8442, longitude: 120.8114 };
const coords = () => ({ coords: { ...position, accuracy: 5 }, timestamp: Date.now() });
const expoLocation = {
    Accuracy: { High: 4, Balanced: 3 },
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    getCurrentPositionAsync: jest.fn(async () => coords()),
    getLastKnownPositionAsync: jest.fn(async () => coords()),
    watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
    reverseGeocodeAsync: jest.fn(async () => []),
    hasStartedLocationUpdatesAsync: jest.fn(async () => false),
    startLocationUpdatesAsync: jest.fn(async () => {}),
    stopLocationUpdatesAsync: jest.fn(async () => {}),
    setPosition(next) {
        position = next;
    },
};

// ---- photo library: "Choose from Gallery" returns a photo named after the call ----
let picks = 0;
const expoImagePicker = {
    MediaType: "images",
    MediaTypeOptions: { Images: "Images" },
    requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    requestCameraPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    launchImageLibraryAsync: jest.fn(async () => {
        picks += 1;
        return {
            canceled: false,
            assets: [{ uri: `file:///photos/photo${picks}.jpg`, fileName: `photo${picks}.jpg`, mimeType: "image/jpeg", width: 800, height: 600 }],
        };
    }),
    launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
};
const expoCamera = {
    Camera: { requestCameraPermissionsAsync: jest.fn(async () => ({ status: "granted" })) },
    CameraView: () => null,
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
};

// ---- background tasks (app minimized): nothing to do in a test ----
const background = {
    stopBackgroundWork: jest.fn(async () => {}),
    startBackgroundWork: jest.fn(async () => {}),
    isAppInForeground: () => true,
    showBookingOffer: jest.fn(),
    showAppNotification: jest.fn(),
    markNotifiedUpTo: jest.fn(),
    setBadgeCount: jest.fn(),
    startDriverLocationUpdates: jest.fn(async () => {}),
    stopDriverLocationUpdates: jest.fn(async () => {}),
    isDriverLocationTaskRunning: jest.fn(async () => false),
};

module.exports = {
    expoRouter,
    router,
    navigation,
    usePath,
    map,
    mapComponent,
    expoLocation,
    expoImagePicker,
    expoCamera,
    background,
};
