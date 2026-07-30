
import { Cookie } from "../utils/cookies";
import { deleteRequest, getRequest, postRequest, putRequest } from "../utils/requests";



export async function getTODAList() {
    const access = Cookie.get("access");
    const response = await getRequest("admin/toda-boundary/", access);
    return response;
}

export async function createTODA(data) {
    const access = Cookie.get("access");
    const response = await postRequest("admin/toda-boundary/", data, access);
    return response;
}

export async function updateTODA(data, id) {
    const access = Cookie.get("access");
    const response = await putRequest(`admin/toda-boundary/${id}/`, data, access);
    return response;
}

export async function deleteTODA(id) {
    const access = Cookie.get("access");
    const response = await deleteRequest(`admin/toda-boundary/${id}/`, access);
    return response;
}

