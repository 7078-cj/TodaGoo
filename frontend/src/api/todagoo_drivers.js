import { Cookie } from "../utils/cookies";
import { deleteRequest, getRequest, patchRequest, putRequest } from "../utils/requests";

export async function getTODAGOODriverList(params) {
    const access = Cookie.get("access");
    const response = await getRequest(`driver/?${new URLSearchParams(params).toString()}`, access);
    return response;
}

export async function blackListTODAGOODriver(id, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await patchRequest(
        `driver/${id}/`,
        { "driver_profile.status": "BLACKLISTED" },
        access,
        false,
        idempotencyKey
    );
    return response;
}

export async function unBlackListTODAGOODriver(id, idempotencyKey = null) {
    const access = Cookie.get("access");
    const response = await patchRequest(
        `driver/${id}/`,
        { "driver_profile.status": "ACTIVE" },
        access,
        false,
        idempotencyKey
    );
    return response;
}