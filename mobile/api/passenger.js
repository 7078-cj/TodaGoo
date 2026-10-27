import { getRequest, postRequest } from "../utils/requests";

export const passengerRegister = async (body) =>{
    const res = await postRequest('passenger/', body, false)
    return res;
}

export const verifyPassengerOtp = async (body) => {
    const res = await postRequest('passenger/verify-otp/', body, true)
    return res.data
}

export const resendPassengerOtp = async () => {
    const res = await postRequest('passenger/resend-otp/', {}, true)
    return res.data
}

export const getPassengerProfile = async () => {
    const res = await getRequest('passenger/me/', {},true)
    return res.data
}