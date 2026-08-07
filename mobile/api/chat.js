import { postRequest, getRequest } from "../utils/requests";

export const postMessage = async (body, idempotencyKey) => {
    const res = await postRequest('chat/', body, true, idempotencyKey)
    if (!res.success) throw new Error(res.error || "Chat failed")
    return res.data;
}

export const getMessages = async (body, idempotencyKey) => {
    const res = await getRequest('chat/', body, true, idempotencyKey)
    if (!res.success) throw new Error(res.error || "Chat failed")
    return res.data;
}

export const seenMessages = async (body, idempotencyKey) => {
    const res = await postRequest('chat/seen/', body, true, idempotencyKey)
    if (!res.success) throw new Error(res.error || "Chat failed")
    return res.data;
}