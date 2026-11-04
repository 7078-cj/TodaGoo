import { postRequest, getRequest, putRequest, deleteRequest } from "../utils/requests";

export const bookRide = async (body, idempotencyKey) => {
    const res = await postRequest('booking/', body, true, idempotencyKey)
    if (!res.success) throw new Error(res.error || "Booking failed")
    return res.data;
}

// Finished rides (completed / cancelled) of the logged-in passenger or driver, newest first,
// each with the other party, stops, ratings and the chat log
export const getBookingHistory = async () => {
    const res = await getRequest('booking/history/', {}, true)
    if (!res.success) throw new Error(res.error || "Failed to load ride history")
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

// location: { latitude, longitude } of the driver; the backend only allows pickup near the start point
export const inProgressBooking = async (bookingId, idempotencyKey, location) => {
    const res = await putRequest(`booking/${bookingId}/`, { status: "in_progress", location }, true, idempotencyKey)
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

    const res = await postRequest(`booking/fare/?${params.toString()}`, {}, true);

    if (!res.success) {
        // res.error may be a string or an object like { error: "..." } / { detail: "..." }
        const message =
            typeof res.error === "string"
                ? res.error
                : res.error?.error || res.error?.detail || "Failed to get fare estimate";
        throw new Error(message);
    }

    const price = Number(res.data?.price);
    if (!Number.isFinite(price)) {
        console.warn("Unexpected fare response:", JSON.stringify(res));
        throw new Error("Unexpected fare response");
    }

    return price;
};

// Cancel a booking that no driver has taken yet (the backend only deletes pending bookings)
export const cancelBooking = async (bookingId) => {
    const res = await deleteRequest(`booking/${bookingId}/`, true)
    if (!res.success) throw new Error(res.error || "Failed to cancel the booking")
    return true;
}
