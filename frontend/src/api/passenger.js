import { Cookie } from "../utils/cookies";
import { deleteRequest, getRequest, patchRequest, putRequest } from "../utils/requests";

export async function getPassengerList(params) {
    const access = Cookie.get("access");
    const response = await getRequest(`passenger/?${new URLSearchParams(params).toString()}`, access);
    return response;
}

export async function blackListPassenger(id, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await patchRequest(
        `passenger/${id}/`,
        { "passenger_profile.status": "BLACKLISTED" },
        access,
        false,
        idempotencyKey
    );
    return response;
}

export async function unBlackListPassenger(id, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await patchRequest(
        `passenger/${id}/`,
        { "passenger_profile.status": "ACTIVE" },
        access,
        false,
        idempotencyKey
    );
    return response;
}