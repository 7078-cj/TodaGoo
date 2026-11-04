// Profile → Reports configuration.

// One entry per backend IncidentReport status (open / resolved / dismissed).
// `label` is what the badge and filter tab show; rename freely (e.g. "Reviewed").
export const REPORT_STATUSES = [
    { status: "open", label: "Open", color: "#2563EB" },
    { status: "resolved", label: "Resolved", color: "#0F5A4A" },
    { status: "dismissed", label: "Dismissed", color: "#6B7280" },
];

// Icon per incident type; anything not listed uses `default`
export const INCIDENT_TYPE_ICONS = {
    accident: "warning-outline",
    reckless_driving: "speedometer-outline",
    harassment: "hand-left-outline",
    overcharging: "receipt-outline",
    lost_item: "briefcase-outline",
    others: "document-text-outline",
    default: "document-text-outline",
};

export const INCIDENT_TYPE_LABELS = {
    accident: "Accident",
    overcharging: "Overcharging",
    reckless_driving: "Reckless Driving",
    harassment: "Harassment",
    lost_item: "Lost Item",
    others: "Others",
};

// "#IR-001"
export const formatReportId = (id) => `#IR-${String(id).padStart(3, "0")}`;

// "Who was involved" (backend INJURED_CHOICES)
export const INJURED_PARTY_LABELS = {
    passenger: "Passenger",
    driver: "Driver",
    others: "Others",
    none: "None",
};
