import { postRequest } from "../utils/requests";

export const submitIncidentReport = async (reportData, idempotent_key) => {
    const res = await postRequest("reports/", reportData, true, idempotent_key);

    return res;
};
