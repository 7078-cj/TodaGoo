import { deleteRequest, getRequest, postRequest } from "../utils/requests";

const RATE_URL = 'booking/rate/'

export const createRate = async (body) => {
    const res = await postRequest(RATE_URL, body, true)
    return res.data
}
