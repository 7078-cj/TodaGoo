const API = import.meta.env.VITE_API_URL;

const handleError = async (res, fallback) => {
    const errorData = await res.json().catch(() => ({}))
    const error = new Error(errorData.detail || errorData.message || fallback)
    Object.assign(error, errorData)
    throw error
}

const buildHeaders = (token, isForm, idempotencyKey) => ({
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(!isForm && { "Content-Type": "application/json" }),
    ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
})

export const getRequest = async (endpoint, token = null) => {
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

export const postRequest = async (endpoint, data = {}, token = null, isForm = false, idempotencyKey = null) => {
    try {
        const headers = buildHeaders(token, isForm, idempotencyKey);

        const res = await fetch(`${API}${endpoint}`, {
            method: "POST",
            headers,
            credentials: "include",
            body: isForm ? data : JSON.stringify(data)
        });

        if (!res.ok) await handleError(res, "Request failed")

        return await res.json();

    } catch (error) {
        console.error("POST REQUEST ERROR:", error);
        throw error;
    }
};

export const putRequest = async (endpoint, data = {}, token = null, isForm = false, idempotencyKey = null) => {
    try {
        const headers = buildHeaders(token, isForm, idempotencyKey);

        const res = await fetch(`${API}${endpoint}`, {
            method: "PUT",
            headers,
            body: isForm ? data : JSON.stringify(data)
        });

        if (!res.ok) await handleError(res, "Update failed")

        return await res.json();

    } catch (error) {
        console.error("PUT REQUEST ERROR:", error);
        throw error;
    }
};

export const patchRequest = async (endpoint, data = {}, token = null, isForm = false, idempotencyKey = null) => {
    try {
        const headers = buildHeaders(token, isForm, idempotencyKey);

        const res = await fetch(`${API}${endpoint}`, {
            method: "PATCH",
            headers,
            body: isForm ? data : JSON.stringify(data)
        });

        if (!res.ok) await handleError(res, "Update failed")

        return await res.json();

    } catch (error) {
        console.error("PATCH REQUEST ERROR:", error);
        throw error;
    }
};

export const deleteRequest = async (endpoint, token = null, idempotencyKey = null) => {
    try {
        const headers = {
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
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