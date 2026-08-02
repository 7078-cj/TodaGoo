import { deleteRequest, getRequest, postRequest } from "../utils/requests";

export const getTodaStations = async (prefix) => {
    const res = await getRequest(`admin/toda-station-prefix/?prefix=${prefix}`, true)
    return res.data;
}