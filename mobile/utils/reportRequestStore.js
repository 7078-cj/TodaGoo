import { useSyncExternalStore } from "react";

// "Open report X in Profile → Reports", set by a tapped "report relayed / resolved / dismissed" notification
// (always one of the user's own reports). { reportId }
// Cleared when the report modal is closed.
let request = null;
const listeners = new Set();

function emit() {
    listeners.forEach((listener) => listener());
}

export function requestReport(reportId) {
    request = reportId != null ? { reportId } : null;
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
