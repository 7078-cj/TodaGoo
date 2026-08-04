import { Cookie } from "../utils/cookies";
import { deleteRequest, getRequest, postRequest, putRequest } from "../utils/requests";

export async function getTODAStationList() {
    const access = Cookie.get("access");
    const response = await getRequest("admin/toda-stations/", access);
    return response;
}

export async function createTODAStation(data, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await postRequest(
        "admin/toda-stations/",
        { name: data.name, location: { lat: data.lat, lng: data.lng } },
        access,
        false,
        idempotencyKey
    );
    return response;
}

export async function updateTODAStation(id, data, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await putRequest(
        `admin/toda-stations/${id}/`,
        { name: data.name, location: { lat: data.lat, lng: data.lng } },
        access,
        false,
        idempotencyKey
    );
    return response;
}

export async function deleteTODAStation(id, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await deleteRequest(`admin/toda-stations/${id}/`, access, idempotencyKey);
    return response;
}