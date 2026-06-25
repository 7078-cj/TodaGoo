import { postRequest } from "../utils/requests";

export const passengerRegister = async (body) =>{
    const res = await postRequest('passenger/', body, false)
    return res;
}
