import AsyncStorage from "@react-native-async-storage/async-storage"

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

const handleError = async (res, fallback) => {
    const errorData = await res.json().catch(() => ({}))
    const error = new Error(errorData.detail || errorData.message || fallback)
    Object.assign(error, errorData)
    throw error
}

const getToken = async (isToken) => {
    if (!isToken) return null
    const stored = await AsyncStorage.getItem("token")
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return parsed?.access ?? null
}

const isFileObject = (value) =>
    value && typeof value === "object" && typeof value.uri === "string"


const containsFile = (value) => {
    if (isFileObject(value)) return true

    if (Array.isArray(value)) {
        return value.some(containsFile)
    }

    if (value && typeof value === "object") {
        return Object.values(value).some(containsFile)
    }

    return false
}

const appendToFormData = (formData, key, value) => {
    if (value === undefined || value === null) return

    if (isFileObject(value)) {
        formData.append(key, {
            uri: value.uri,
            name: value.fileName || value.name || `${key}.jpg`,
            type: value.mimeType || value.type || "image/jpeg",
        })
        return
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            appendToFormData(formData, `${key}[${index}]`, item)
        )
        return
    }

    if (typeof value === "object") {
        Object.entries(value).forEach(([childKey, childValue]) =>
            appendToFormData(formData, `${key}.${childKey}`, childValue)
        )
        return
    }

    formData.append(key, value)
}

export const buildFormData = (data) => {
    const formData = new FormData()

    Object.entries(data).forEach(([key, value]) => {
        appendToFormData(formData, key, value)
    })

    return formData
}

const resolveBody = (data) => {
    const hasFile = containsFile(data)
    if (hasFile) {
        return { body: buildFormData(data), isForm: true }
    }
    return { body: JSON.stringify(data), isForm: false }
}

export const getRequest = async (endpoint, isToken = false) => {
    const token = await getToken(isToken)

    try {
        const res = await fetch(`${API}${endpoint}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` })
            }
        });

        if (!res.ok) await handleError(res, "Request failed")

        return await res.json();

    } catch (error) {
        console.error("GET REQUEST ERROR:", error);
        throw error;
    }
};

export const postRequest = async (endpoint, data = {}, isToken = false) => {
    const token = await getToken(isToken)

    try {
        const { body, isForm } = resolveBody(data)

        const headers = {
            ...(token && { Authorization: `Bearer ${token}` })
        };

        if (!isForm) {
            headers["Content-Type"] = "application/json";
        }
        console.log(body)

        const res = await fetch(`${API}${endpoint}`, {
            method: "POST",
            headers,
            credentials: "include",
            body
        });

        if (!res.ok) await handleError(res, "Request failed")

        return await res.json();

    } catch (error) {
        console.error("POST REQUEST ERROR:", error);
        throw error;
    }
};

export const putRequest = async (endpoint, data = {}, isToken = false) => {
    const token = await getToken(isToken)

    try {
        const { body, isForm } = resolveBody(data)

        const headers = {
            ...(token && { Authorization: `Bearer ${token}` })
        };

        if (!isForm) {
            headers["Content-Type"] = "application/json";
        }

        const res = await fetch(`${API}${endpoint}`, {
            method: "PUT",
            headers,
            body
        });

        if (!res.ok) await handleError(res, "Update failed")

        return await res.json();

    } catch (error) {
        console.error("PUT REQUEST ERROR:", error);
        throw error;
    }
};

export const patchRequest = async (endpoint, data = {}, isToken = false) => {
    const token = await getToken(isToken)

    try {
        const { body, isForm } = resolveBody(data)

        const headers = {
            ...(token && { Authorization: `Bearer ${token}` })
        };

        if (!isForm) {
            headers["Content-Type"] = "application/json";
        }

        const res = await fetch(`${API}${endpoint}`, {
            method: "PATCH",
            headers,
            body
        });

        if (!res.ok) await handleError(res, "Update failed")

        return await res.json();

    } catch (error) {
        console.error("PATCH REQUEST ERROR:", error);
        throw error;
    }
};

export const deleteRequest = async (endpoint, isToken = false) => {
    const token = await getToken(isToken)

    try {
        const headers = {
            ...(token && { Authorization: `Bearer ${token}` })
        };

        const res = await fetch(`${API}${endpoint}`, {
            method: "DELETE",
            headers,
            credentials: "include",
        });

        if (res.status === 204) return true

        if (!res.ok) await handleError(res, "Delete failed")

        return await res.json().catch(() => null)

    } catch (error) {
        console.error("DELETE REQUEST ERROR:", error);
        throw error;
    }
};