import { useSyncExternalStore } from "react";

// "Open report X in Profile → Reports", set by a tapped report notification.
// { reportId, limited }: limited = the report was filed ABOUT the user (opens the "about me" view).
// Cleared when the report modal is closed.
let request = null;
const listeners = new Set();

function emit() {
    listeners.forEach((listener) => listener());
}

export function requestReport(reportId, limited) {
    request = reportId != null ? { reportId, limited: !!limited } : null;
    emit();
}

export function clearReportRequest() {
    if (request === null) return;
    request = null;
    emit();
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useReportRequest() {
    return useSyncExternalStore(subscribe, () => request);
}
