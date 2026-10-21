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

/**
 * Gets the fare estimate for a route.
 * start / end: { lat, lng }
 * stops: [{ lat, lng }, ...] (optional)
 */
export const getFarePrice = async (start, end, stops = []) => {
    const params = new URLSearchParams();
    params.set("start", `${start.lat},${start.lng}`);
    params.set("end", `${end.lat},${end.lng}`);
    stops.forEach((stop) => params.append("stops", `${stop.lat},${stop.lng}`));

    const res = await postRequest(`booking/fare/?${params.toString()}`, {}, true)
    if (!res.success) throw new Error(res.error || "Failed to get fare price")
    return res.data.price;
}