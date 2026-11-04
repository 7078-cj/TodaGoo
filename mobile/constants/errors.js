// One place to configure how errors are reported to the user.
// Used by utils/requests.js (every API call), components/feedback (ErrorBoundary, ErrorState).

export const REQUEST_TIMEOUT_MS = 20000; // a request with no answer after this fails with "timeout"
export const UPLOAD_TIMEOUT_MS = 60000;  // multipart requests (photos) get longer

// `kind` on a failed request result: network | timeout | auth | forbidden | not_found | throttled | validation | server | http
export const ERROR_MESSAGES = {
    network: "Can't reach the server. Check your internet connection and try again.",
    timeout: "The server took too long to respond. Please try again.",
    auth: "Your session has expired. Please log in again.",
    forbidden: "You don't have permission to do that.",
    not_found: "We couldn't find what you were looking for.",
    throttled: "Too many attempts. Please wait a moment and try again.",
    server: "Something went wrong on our side. Please try again in a moment.",
    generic: "Something went wrong. Please try again.",
    crash: "Something went wrong and this screen couldn't be shown.",
};

// First human-readable message in a DRF error body:
// { detail } / { field: ["msg"] } / { profile: { field: ["msg"] } } / ["msg"]
export function firstErrorMessage(data) {
    if (data == null) return null;
    if (typeof data === "string") return data;
    if (Array.isArray(data)) {
        for (const item of data) {
            const found = firstErrorMessage(item);
            if (found) return found;
        }
        return null;
    }
    if (typeof data === "object") {
        for (const key of ["detail", "message", "error", "non_field_errors"]) {
            const found = firstErrorMessage(data[key]);
            if (found) return found;
        }
        for (const value of Object.values(data)) {
            const found = firstErrorMessage(value);
            if (found) return found;
        }
    }
    return null;
}

// A message for anything: an Error, a request result ({ error }), or a string
export function getErrorMessage(err, fallback = ERROR_MESSAGES.generic) {
    if (!err) return fallback;
    if (typeof err === "string") return err;
    return err.error || err.message || fallback;
}
