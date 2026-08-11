import { Cookie } from "../utils/cookies";
import { deleteRequest, getRequest, patchRequest, putRequest } from "../utils/requests";

export async function getIncidentReports(params) {
    const access = Cookie.get("access");
    const response = await getRequest(`reports/?${new URLSearchParams(params).toString()}`, access);
    return response;
}

export async function updateIncidentReportsStatus(reportId, status,) {
    const access = Cookie.get("access");
    const response = await patchRequest(`reports/${reportId}/`, {status: status} ,access);
    return response;
}

