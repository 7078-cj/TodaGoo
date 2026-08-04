import { postRequest, getRequest, putRequest } from "../utils/requests";

export const bookRide = async (body, idempotencyKey) => {
    const res = await postRequest('booking/', body, true, idempotencyKey)
    if (!res.success) throw new Error(res.error || "Booking failed")
    return res.data;
}

export const getBooking = async (bookingId) => {
    const res = await getRequest(`booking/${bookingId}/`, true)
    if (!res.success) throw new Error(res.error || "Failed to fetch booking")
    return res.data;
}

export const updateBooking = async (bookingId, body, idempotencyKey) => {
    const res = await putRequest(`booking/${bookingId}/`, body, true, idempotencyKey)
    if (!res.success) throw new Error(res.error || "Update failed")
    return res.data;
}

export const completeBooking = async (bookingId, idempotencyKey) => {
    const res = await putRequest(`booking/${bookingId}/`, { status: "completed" }, true, idempotencyKey)
    if (!res.success) throw new Error(res.error || "Failed to complete booking")
    return res.data;
}

export const inProgressBooking = async (bookingId, idempotencyKey) => {
    const res = await putRequest(`booking/${bookingId}/`, { status: "in_progress" }, true, idempotencyKey)
    if (!res.success) throw new Error(res.error || "Failed to update booking status")
    return res.data;
}

export const rateUser = async (bookingId, userId, score, idempotencyKey) => {
    const res = await postRequest('booking/rate/', { booking_id: bookingId, user_id: userId, score }, true, idempotencyKey)
    if (!res.success) throw new Error(res.error || "Failed to submit rating")
    return res.data;
}