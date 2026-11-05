// Incident report statuses (backend IncidentReport.STATUS_CHOICES): label for the badge and the
// status dropdown, and the badge colours. "Relayed to MDRRMO": a TODA admin passed the report on
// to MDRRMO; it stays open until it's resolved or dismissed.
export const REPORT_STATUSES = [
    { value: "open", label: "Open", style: "bg-amber-100 text-amber-800 ring-amber-600/20" },
    { value: "relayed_to_mdrrmo", label: "Relayed to MDRRMO", style: "bg-sky-100 text-sky-800 ring-sky-600/20" },
    { value: "resolved", label: "Resolved", style: "bg-emerald-100 text-emerald-800 ring-emerald-600/20" },
    { value: "dismissed", label: "Dismissed", style: "bg-gray-100 text-gray-600 ring-gray-500/20" },
];

const byValue = Object.fromEntries(REPORT_STATUSES.map((s) => [s.value, s]));

export const reportStatusLabel = (status) => byValue[status]?.label ?? status;
export const reportStatusStyle = (status) => (byValue[status] ?? byValue.open).style;
