import { getRequest, postRequest } from "../utils/requests";

export const submitIncidentReport = async (reportData, idempotent_key) => {
    const res = await postRequest("reports/", {
        incident_types: reportData.incident_types,
        injured_party: reportData.injured_party, 
        details: reportData.details, 
        location:{lat: reportData.location.lat, lng: reportData.location.lng},
        evidence_files: reportData.evidence_files,
        booking_id: reportData.booking_id

    }, true, idempotent_key);

    return res;
};

// Reports filed by the logged-in user (first page, newest first)
export const getMyReports = async () => {
    const res = await getRequest("reports/", {}, true);
    if (!res.success) throw new Error(res.error || "Failed to load reports");
    return res.data?.results ?? [];
};
