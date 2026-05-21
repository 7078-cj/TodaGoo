
import { Cookie } from "../utils/cookies";
import { getRequest, postRequest } from "../utils/requests";



export async function getTODAList() {
    const access = Cookie.get("access");
    const response = await getRequest("admin/toda-stations/", access);
    return response;
}

export async function createTODA(data) {
    const access = Cookie.get("access");
    const response = await postRequest("admin/toda-stations/", data, access);
    return response;
}