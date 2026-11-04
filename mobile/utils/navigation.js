import { router } from "expo-router";

// Whether `pathname` (e.g. "/(protected)/driver/en_route") is anywhere in the navigation state.
// Walks the nested navigators segment by segment: "(protected)" → "driver" → "en_route".
export function isInStack(state, pathname) {
    const segments = pathname.split("/").filter(Boolean);
    let routes = state?.routes;

    for (const segment of segments) {
        const route = routes?.find((r) => r.name === segment);
        if (!route) return false;
        routes = route.state?.routes;
    }
    return true;
}

// Go to `pathname` without stacking a second copy of the screen or its layout.
//
// `push` (and `navigate`, which also pushes in this expo-router / React Navigation 7) from a screen
// outside the driver / passenger layout, e.g. History or Profile, adds a NEW instance of that whole
// layout: a second DriverProvider, a second driver socket and a second "New Booking" modal, so every
// offer showed twice. `dismissTo` goes back to the existing instance and navigates inside it.
//
// `rootState`: from useNavigationContainerRef().getRootState() or useRootNavigationState().
export function goTo(pathname, rootState) {
    const segments = pathname.split("/").filter(Boolean);
    // the layout / screen directly under the group, e.g. "/(protected)/driver" or "/(protected)/history"
    const owner = "/" + segments.slice(0, segments[0]?.startsWith("(") ? 2 : 1).join("/");

    if (isInStack(rootState, owner)) router.dismissTo(pathname);
    else router.push(pathname);
}
