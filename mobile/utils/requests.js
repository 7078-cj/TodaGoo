import { Platform } from "react-native";
import { File } from "expo-file-system";
import { getStoredToken } from "./tokenStorage";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

const getToken = async (isToken) => {
    if (!isToken) return null;

    const stored = await getStoredToken(); // [SEC-L4] secure storage
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return parsed?.access ?? null;
};

const handleError = async (res, fallback) => {
    const errorData = await res.json().catch(() => ({}));

    return {
        success: false,
        status: res.status,
        error:
            errorData.detail ||
            errorData.message ||
            errorData.error ||
            fallback,
        data: errorData,
    };
};

const successResponse = async (res) => {
    const data = await res.json().catch(() => ({}));

    return {
        success: true,
        status: res.status,
        data,
    };
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
    try {
        const token = await getToken(isToken);

        const query = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
        ).toString();

        const url = query ? `${API}${endpoint}?${query}` : `${API}${endpoint}`;

        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                ...(token && {
                    Authorization: `Bearer ${token}`,
                }),
            },
        });

        if (!res.ok) {
            return await handleError(res, "Request failed");
        }

        return await successResponse(res);
    } catch (error) {
        return {
            success: false,
            error: error.message || "Network error",
        };
    }
};

export const postRequest = async (
    endpoint,
    data = {},
    isToken = false,
    idempotencyKey = null
) => {
    try {
        const token = await getToken(isToken);

        const { body, isForm } = resolveBody(data);

        const headers = buildHeaders(token, idempotencyKey);

        if (!isForm) {
            headers["Content-Type"] = "application/json";
        }

        const res = await fetch(`${API}${endpoint}`, {
            method: "POST",
            headers,
            credentials: "include",
            body,
        });

        if (!res.ok) {
            return await handleError(res, "Request failed");
        }

        return await successResponse(res);
    } catch (error) {
        return {
            success: false,
            error: error.message || "Network error",
        };
    }
};

export const putRequest = async (
    endpoint,
    data = {},
    isToken = false,
    idempotencyKey = null
) => {
    try {
        const token = await getToken(isToken);

        const { body, isForm } = resolveBody(data);

        const headers = buildHeaders(token, idempotencyKey);

        if (!isForm) {
            headers["Content-Type"] = "application/json";
        }

        const res = await fetch(`${API}${endpoint}`, {
            method: "PUT",
            headers,
            body,
        });

        if (!res.ok) {
            return await handleError(res, "Update failed");
        }

        return await successResponse(res);
    } catch (error) {
        return {
            success: false,
            error: error.message || "Network error",
        };
    }
};

export const patchRequest = async (
    endpoint,
    data = {},
    isToken = false,
    idempotencyKey = null
) => {
    try {
        const token = await getToken(isToken);

        const { body, isForm } = resolveBody(data);

        const headers = buildHeaders(token, idempotencyKey);

        if (!isForm) {
            headers["Content-Type"] = "application/json";
        }

        const res = await fetch(`${API}${endpoint}`, {
            method: "PATCH",
            headers,
            body,
        });

        if (!res.ok) {
            return await handleError(res, "Update failed");
        }

        return await successResponse(res);
    } catch (error) {
        return {
            success: false,
            error: error.message || "Network error",
        };
    }
};

export const deleteRequest = async (
    endpoint,
    isToken = false,
    idempotencyKey = null
) => {
    try {
        const token = await getToken(isToken);

        const headers = buildHeaders(token, idempotencyKey);

        const res = await fetch(`${API}${endpoint}`, {
            method: "DELETE",
            headers,
            credentials: "include",
        });

        if (res.status === 204) {
            return {
                success: true,
                status: 204,
            };
        }

        if (!res.ok) {
            return await handleError(res, "Delete failed");
        }

        return await successResponse(res);
    } catch (error) {
        return {
            success: false,
            error: error.message || "Network error",
        };
    }
};