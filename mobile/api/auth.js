import { postRequest } from "../utils/requests";


export async function loginRequest(email, password) {
    const res = await postRequest('user/token/user', {email, password}, false)
    return res;
}
