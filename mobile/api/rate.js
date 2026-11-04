import { postRequest } from "../utils/requests";

const RATE_URL = 'booking/rate/'

// Throws on failure; err.data holds the field errors (e.g. "You have already rated this booking")
export const createRate = async (body) => {
    const res = await postRequest(RATE_URL, body, true)
    if (!res.success) {
        const error = new Error(res.error || "Failed to submit rating")
        error.data = res.data
        throw error
    }
    return res.data
}
