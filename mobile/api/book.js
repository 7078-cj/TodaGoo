import { postRequest, getRequest, putRequest } from "../utils/requests";

export const bookRide = async (body) =>{
    const res = await postRequest('booking/', body, true)
    return res.data;
}

export const getBooking = async (bookingId) =>{
    const res = await getRequest(`booking/${bookingId}/`, true)
    return res.data;
}

export const updateBooking = async (bookingId, body) =>{
    const res = await putRequest(`booking/${bookingId}/`, body, true)
    return res.data;
}

export const completeBooking = async (bookingId) =>{
    const res = await putRequest(`booking/${bookingId}/`, {status: "completed"}, true)
    return res.data;
}

export const inProgressBooking = async (bookingId) =>{
    const res = await putRequest(`booking/${bookingId}/`, {status: "in_progress"}, true)
    return res.data;
}