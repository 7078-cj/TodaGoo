import { Cookie } from "../utils/cookies";
import {
    deleteRequest,
    getRequest,
    patchRequest, // add this to utils/requests if it doesn't exist yet
    postRequest,
    putRequest,
} from "../utils/requests";

export async function getTODAList() {
    const access = Cookie.get("access");
    const response = await getRequest("admin/toda-boundary/", access);
    return response;
}

export async function createTODA(data, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await postRequest("admin/toda-boundary/", data, access, false, idempotencyKey);
    return response;
}

export async function updateTODA(data, id, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await putRequest(`admin/toda-boundary/${id}/`, data, access, false, idempotencyKey);
    return response;
}

export async function deleteTODA(id, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await deleteRequest(`admin/toda-boundary/${id}/`, access, idempotencyKey);
    return response;
}

export async function getBookingSettings() {
    const access = Cookie.get("access");
    const response = await getRequest("admin/booking-settings/", access);
    return response;
}

export async function updateBookingSettings(data, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await patchRequest("admin/booking-settings/", data, access, false, idempotencyKey);
    return response;
}

export async function getDashboardOverview() {
    const access = Cookie.get("access");
    const response = await getRequest("admin/dashboard/", access);
    return response;
}