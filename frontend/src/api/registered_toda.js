import { Cookie } from "../utils/cookies";
import { deleteRequest, getRequest, postRequest, putRequest } from "../utils/requests";

export async function getRegisteredTODAList(params) {
    const access = Cookie.get("access");
    const response = await getRequest(`admin/todas/?${new URLSearchParams(params).toString()}`, access);
    return response;
}

export async function createRegisteredTODA(data, isFormData = false, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await postRequest("admin/todas/", data, access, isFormData, idempotencyKey);
    return response;
}

export async function updateRegisteredTODA(id, data, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await putRequest(`admin/todas/${id}/`, data, access, false, idempotencyKey);
    return response;
}

export async function deleteRegisteredTODA(id, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await deleteRequest(`admin/todas/${id}/`, access, idempotencyKey);
    return response;
}