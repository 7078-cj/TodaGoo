import { Platform } from "react-native";
import { File } from "expo-file-system";
import { getStoredToken } from "./tokenStorage";
import { ERROR_MESSAGES, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, firstErrorMessage } from "../constants/errors";

import config from "../constants/config";

// always ends with "/" (constants/config.js), so `${API}booking/` is a valid URL
const API = config.apiUrl;

const getToken = async (isToken) => {
    if (!isToken) return null;

    const stored = await getStoredToken(); // [SEC-L4] secure storage
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return parsed?.access ?? null;
};

// Error result for a non-2xx response. `error` is always something a user can read:
// the server's own message when it has one (validation, "already rated", ...), otherwise a
// friendly one per status. `kind` lets screens react (e.g. "auth" -> log in again).
const handleError = async (res, fallback) => {
    const errorData = await res.json().catch(() => ({})); // HTML error pages aren't JSON
    const serverMessage = firstErrorMessage(errorData);
    const status = res.status;

    let kind = "http";
    let error = serverMessage || fallback;
    if (status >= 500) {
        kind = "server";
        error = ERROR_MESSAGES.server;
    } else if (status === 401) {
        kind = "auth";
        // an expired / invalid token says so in technical terms; login failures keep their message
        if (errorData?.code === "token_not_valid" || !serverMessage) error = ERROR_MESSAGES.auth;
    } else if (status === 403) {
        kind = "forbidden";
        error = serverMessage || ERROR_MESSAGES.forbidden;
    } else if (status === 404) {
        kind = "not_found";
        error = serverMessage && serverMessage !== "Not found." ? serverMessage : ERROR_MESSAGES.not_found;
    } else if (status === 429) {
        kind = "throttled";
        error = ERROR_MESSAGES.throttled;
    } else if (status === 400 || status === 409) {
        kind = "validation";
    }

    return { success: false, status, kind, error, data: errorData };
};

const successResponse = async (res) => {
    const data = await res.json().catch(() => ({}));

    return {
        success: true,
        status: res.status,
        data,
    };
};

// fetch with a timeout and one error shape for "no answer": offline / server unreachable / too slow
const send = async (url, options, { isForm = false, fallback = "Request failed" } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), isForm ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (res.status === 204) return { success: true, status: 204 };
        return res.ok ? await successResponse(res) : await handleError(res, fallback);
    } catch (error) {
        const timedOut = error?.name === "AbortError";
        if (!timedOut) console.log("Request failed:", options?.method, url, error?.message);
        return {
            success: false,
            status: 0,
            kind: timedOut ? "timeout" : "network",
            error: timedOut ? ERROR_MESSAGES.timeout : ERROR_MESSAGES.network,
            data: null,
        };
    } finally {
        clearTimeout(timer);
    }
};

const isFileObject = (value) =>
    value &&
    typeof value === "object" &&
    typeof value.uri === "string";

const containsFile = (value) => {
    if (isFileObject(value)) return true;

    if (Array.isArray(value)) {
        return value.some(containsFile);
    }

    if (value && typeof value === "object") {
        return Object.values(value).some(containsFile);
    }

    return false;
};

// A picked image as a multipart part.
// Expo replaces the global fetch with its own (expo/winter), which builds multipart bodies itself and
// only accepts strings, Blobs or objects with bytes(): React Native's { uri, name, type } parts throw
// "Unsupported FormDataPart implementation". expo-file-system's File reads the image's bytes and
// carries its name and MIME type. Web keeps the old shape (browser FormData, no local file paths).
const toUploadPart = (key, value) => {
    if (Platform.OS === "web") {
        return {
            uri: value.uri,
            name: value.fileName || value.name || `${key}.jpg`,
            type: value.mimeType || value.type || "image/jpeg",
        };
    }
    return new File(value.uri);
};

const appendToFormData = (formData, key, value) => {
    if (value === undefined || value === null) return;

    if (isFileObject(value)) {
        formData.append(key, toUploadPart(key, value));
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            appendToFormData(formData, `${key}[${index}]`, item)
        );
        return;
    }

    if (typeof value === "object") {
        Object.entries(value).forEach(([childKey, childValue]) =>
            appendToFormData(formData, `${key}.${childKey}`, childValue)
        );
        return;
    }

    formData.append(key, value);
};

export const buildFormData = (data) => {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
        appendToFormData(formData, key, value);
    });

    return formData;
};

const resolveBody = (data) => {
    const hasFile = containsFile(data);

    if (hasFile) {
        return {
            body: buildFormData(data),
            isForm: true,
        };
    }

    return {
        body: JSON.stringify(data),
        isForm: false,
    };
};


const buildHeaders = (token, idempotencyKey) => ({
    ...(token && {
        Authorization: `Bearer ${token}`,
    }),
    ...(idempotencyKey && {
        "Idempotency-Key": idempotencyKey,
    }),
});

export const getRequest = async (endpoint, params = {}, isToken = false) => {
    const token = await getToken(isToken);

    const query = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();

    const url = query ? `${API}${endpoint}?${query}` : `${API}${endpoint}`;

    return send(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            ...(token && {
                Authorization: `Bearer ${token}`,
            }),
        },
    });
};

// POST / PUT / PATCH share this: JSON, or multipart when the data contains a picked file
const sendWithBody = async (method, endpoint, data, isToken, idempotencyKey, fallback, extra = {}) => {
    const token = await getToken(isToken);

    const { body, isForm } = resolveBody(data);

    const headers = buildHeaders(token, idempotencyKey);

    if (!isForm) {
        headers["Content-Type"] = "application/json";
    }

    return send(`${API}${endpoint}`, { method, headers, body, ...extra }, { isForm, fallback });
};

export const postRequest = async (
    endpoint,
    data = {},
    isToken = false,
    idempotencyKey = null
) => sendWithBody("POST", endpoint, data, isToken, idempotencyKey, "Request failed", { credentials: "include" });

export const putRequest = async (
    endpoint,
    data = {},
    isToken = false,
    idempotencyKey = null
) => sendWithBody("PUT", endpoint, data, isToken, idempotencyKey, "Update failed");

export const patchRequest = async (
    endpoint,
    data = {},
    isToken = false,
    idempotencyKey = null
) => sendWithBody("PATCH", endpoint, data, isToken, idempotencyKey, "Update failed");

export const deleteRequest = async (
    endpoint,
    isToken = false,
    idempotencyKey = null
) => {
    const token = await getToken(isToken);

    const headers = buildHeaders(token, idempotencyKey);

    return send(`${API}${endpoint}`, {
        method: "DELETE",
        headers,
        credentials: "include",
    }, { fallback: "Delete failed" });
};
