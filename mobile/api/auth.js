import { postRequest } from "../utils/requests";


export async function loginRequest(email, password) {
    const res = await postRequest('user/token/user')
    return res.json();
}

export async function registerRequest(body) {
    const res = await postRequest('user/register/')
    const data = (await res.json().catch(() => ({})));
    return { res, data };
    }