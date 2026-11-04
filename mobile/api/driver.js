import { deleteRequest, getRequest, postRequest, patchRequest } from "../utils/requests";

export const driverRegister = async (body) =>{
    const res = await postRequest('driver/', body, false)
    return res;
}

export const driverQueueStatus = async () => {
    const res = await getRequest('booking/driver/queue/status',{}, true)
    return res.data
}

// Join the queue ("Ready"). Throws with the server's message on failure (e.g. not verified / already queued)
export const driverQueue = async (location) => {
    const res = await postRequest('booking/driver/queue', location, true)
    if (!res.success) throw new Error(res.error || "Failed to go online")
    return res.data
}

// Leave the queue ("Go Offline"). Throws with the server's message on failure
export const driverDequeue = async () => {
    const res = await deleteRequest('booking/driver/dequeue', true)
    if (!res.success) throw new Error(res.error || "Failed to go offline")
    return res.data
}

export const verifyDriverOtp = async (body) => {
    const res = await postRequest('driver/verify-otp/', body, true)
    return res.data
}

export const resendDriverOtp = async () => {
    const res = await postRequest('driver/resend-otp/', {}, true)
    return res.data
}

export const getDriverProfile = async () => {
    const res = await getRequest('driver/me/',{}, true)
    return res.data
}

// body: { first_name, ..., driver_profile: { address, contact_number, profile_picture, vehicle_front_picture, ... } }
export const updateDriverProfile = async (userId, body) => {
    return await patchRequest(`driver/${userId}/`, body, true)
}

// { today: { total, trips }, week: { total, trips }, month: { total, trips } } from completed rides
export const getDriverEarnings = async () => {
    const res = await getRequest('driver/earnings/', {}, true)
    if (!res.success) throw new Error(res.error || "Failed to load earnings")
    return res.data
}
