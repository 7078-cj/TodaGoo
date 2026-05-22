
import { Cookie } from "../utils/cookies";
import { deleteRequest, getRequest, postRequest, putRequest } from "../utils/requests";



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

export async function updateTODA(data, id) {
    const access = Cookie.get("access");
    const response = await putRequest(`admin/toda-stations/${id}/`, data, access);
    return response;
}

export async function deleteTODA(id) {
    const access = Cookie.get("access");
    const response = await deleteRequest(`admin/toda-stations/${id}/`, access);
    return response;
}

