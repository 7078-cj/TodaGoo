import { useEffect } from "react";
import { startBackgroundWork } from "../background";
import useNotificationTaps from "../hooks/useNotificationTaps";

// Rendered once inside the logged-in app: starts the background notification check and
// opens the right screen when a phone notification is tapped. Renders nothing.
export default function BackgroundWork() {
    useEffect(() => {
        startBackgroundWork();
    }, []);

    useNotificationTaps();
    return null;
}
