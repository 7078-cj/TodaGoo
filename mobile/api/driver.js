import { deleteRequest, getRequest, postRequest } from "../utils/requests";

export const driverRegister = async (body) =>{
    const res = await postRequest('driver/', body, false)
    return res;
}

export const driverQueueStatus = async () => {
    const res = await getRequest('booking/driver/queue/status', true)
    return res.data
}

export const driverQueue = async (location) => {
    const res = await postRequest('booking/driver/queue', location, true)
    return res.data
}

export const driverDequeue = async () => {
    const res = await deleteRequest('booking/driver/queue', true)
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
    const res = await getRequest('driver/me/', true)
    return res.data
}