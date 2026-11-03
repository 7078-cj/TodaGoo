import { getRequest, postRequest, patchRequest } from "../utils/requests";

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

// body: { first_name, ..., passenger_profile: { address, ..., profile_picture } }.
// With a photo the request goes as multipart ("passenger_profile.address", ...), which the backend expects.
export const updatePassengerProfile = async (userId, body) => {
    return await patchRequest(`passenger/${userId}/`, body, true)
}
