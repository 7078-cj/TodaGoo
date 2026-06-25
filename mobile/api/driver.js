import { postRequest } from "../utils/requests";

export const driverRegister = async (body) =>{
    const res = await postRequest('driver/', body, false)
    return res;
}