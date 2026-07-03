import { postRequest, getRequest, putRequest } from "../utils/requests";

export const bookRide = async (body) =>{
    const res = await postRequest('booking/', body, false)
    return res.data;
}

export const getBooking = async (bookingId) =>{
    const res = await getRequest(`booking/${bookingId}/`, false)
    return res.data;
}

export const updateBooking = async (bookingId, body) =>{
    const res = await putRequest(`booking/${bookingId}/`, body, false)
    return res.data;
}
