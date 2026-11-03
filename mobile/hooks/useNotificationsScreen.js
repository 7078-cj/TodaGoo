import { useCallback } from "react";
import { router, usePathname } from "expo-router";
import { useProfile } from "../contexts/ProfileContext";

const NOTIFICATIONS_PATH = "/notifications";

// Open / close / toggle the notifications screen. Shared by the header bell and the screen's X.
export default function useNotificationsScreen() {
    const pathname = usePathname();
    const { role } = useProfile();
    const isOpen = pathname === NOTIFICATIONS_PATH;

    const open = useCallback(() => {
        router.push(NOTIFICATIONS_PATH);
    }, []);

    // Back to wherever it was opened from; with no history, the user's own home
    const close = useCallback(() => {
        if (router.canGoBack()) router.back();
        else router.replace(`/(protected)/${role === "driver" ? "driver" : "passenger"}/home`);
    }, [role]);

    const toggle = useCallback(() => {
        if (isOpen) close();
        else open();
    }, [isOpen, open, close]);

    return { isOpen, open, close, toggle };
}
