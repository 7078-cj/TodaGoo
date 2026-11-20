import React, { useState } from 'react'
import { AlertTriangle, FileText, PackageSearch, CircleAlert } from 'lucide-react'
import {
    updateIncidentReportsStatus,
    updateIncidentReportsSeverity,
} from '../../api/incident_reports';
import { REPORT_STATUSES, reportStatusLabel, reportStatusStyle } from '../../constants/reportStatuses';
import colors from '../../constants/colors'; // adjust path

const SEVERITY_STYLES = {
    severe: 'bg-orange-50 text-orange-700 ring-orange-300',
    moderate: 'bg-blue-50 text-blue-700 ring-blue-300',
    minor: 'bg-gray-50 text-gray-600 ring-gray-300',
}

const SEVERITY_CHOICES = [
    { value: 'minor', label: 'Minor' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'severe', label: 'Severe' },
]

// Icon + tint per incident type. Adjust the keys to match your incident_types values.
function typeIcon(type = "") {
    if (type.includes("reckless")) return { Icon: AlertTriangle, color: '#7B1FA2', bg: '#F3E8FF' }
    if (type.includes("overcharg")) return { Icon: FileText, color: colors.primary, bg: '#FFF1E6' }
    if (type.includes("lost")) return { Icon: PackageSearch, color: colors.secondary, bg: '#E6F4EE' }
    return { Icon: CircleAlert, color: colors.primary, bg: '#FFF1E6' }
}

const titleCase = (s = "") =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export const reportCode = (report) => `IR-${String(report.id).padStart(3, "0")}`
export const reportTitle = (report) => `${titleCase(report.incident_types)} | ${reportCode(report)}`

function reporterName(report) {
    const p = report.reporter ?? report.booking?.passenger
    if (!p) return "Unknown"
    return typeof p === "string" ? p : `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
}

const Pill = ({ className = "", children }) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}>
        {children}
    </span>
)

export default function IncidentReportCard({ report, selected, canUpdateStatus, onStatusUpdated, onViewDetails }) {
    const [updating, setUpdating] = useState(false)
    const [error, setError] = useState(null)

    const { Icon, color, bg } = typeIcon(report.incident_types)
    const tags = report.tags ?? []
    const severity = report.severity?.toLowerCase() ?? ""

    // The PATCH response only returns the restricted fields
    // (id, status, resolution, resolved_at, severity), so merge it into the
    // existing report instead of replacing it.
    const applyUpdate = (res, fallback) => {
        const data = res?.data ?? res
        onStatusUpdated({ ...report, ...fallback, ...(data && typeof data === "object" ? data : {}) })
    }

    const handleStatusChange = async (e) => {
        const newStatus = e.target.value
        if (newStatus === report.status) return

        setUpdating(true)
        setError(null)
        try {
            const res = await updateIncidentReportsStatus(report.id, newStatus)
            applyUpdate(res, { status: newStatus })
        } catch {
            setError("Failed to update status.")
        } finally {
            setUpdating(false)
        }
    }

    const handleSeverityChange = async (e) => {
        const newSeverity = e.target.value
        if (!newSeverity || newSeverity === severity) return

        setUpdating(true)
        setError(null)
        try {
            const res = await updateIncidentReportsSeverity(report.id, newSeverity)
            applyUpdate(res, { severity: newSeverity })
        } catch {
            setError("Failed to update severity.")
        } finally {
            setUpdating(false)
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onViewDetails(report)}
            onKeyDown={(e) => e.key === "Enter" && onViewDetails(report)}
            className="flex items-center gap-4 rounded-xl border px-4 py-3 cursor-pointer transition-shadow hover:shadow-md"
            style={{
                backgroundColor: colors.surface,
                borderColor: selected ? colors.secondary : colors.border,
                boxShadow: selected ? `0 0 0 2px ${colors.secondary}` : undefined,
            }}
        >
            {/* Type icon */}
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                style={{ backgroundColor: bg, borderColor: color }}
            >
                <Icon className="h-5 w-5" style={{ color }} />
            </div>

            {/* Title, meta, tags */}
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: colors.dark }}>
                    {reportTitle(report)}
                </p>
                <p className="text-xs text-gray-500">
                    {new Date(report.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {" • "}Reporter: {reporterName(report)}
                </p>
                {tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                            <Pill key={tag} className="bg-orange-50 text-orange-700 ring-orange-300">
                                {titleCase(tag)}
                            </Pill>
                        ))}
                    </div>
                )}
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            </div>

            {/* Severity + status */}
            <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {canUpdateStatus ? (
                    <select
                        value={severity}
                        onChange={handleSeverityChange}
                        disabled={updating}
                        aria-label="Severity"
                        className="rounded-full border py-0.5 pl-2 pr-6 text-[11px] disabled:opacity-50"
                        style={{ borderColor: colors.border, color: colors.dark }}
                    >
                        {!severity && (
                            <option value="" disabled>
                                Set severity
                            </option>
                        )}
                        {SEVERITY_CHOICES.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                                {choice.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    severity && (
                        <Pill className={SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.minor}>
                            {titleCase(severity)}
                        </Pill>
                    )
                )}

                {canUpdateStatus ? (
                    <select
                        value={report.status}
                        onChange={handleStatusChange}
                        disabled={updating}
                        aria-label="Status"
                        className="rounded-full border py-0.5 pl-2 pr-6 text-[11px] disabled:opacity-50"
                        style={{ borderColor: colors.border, color: colors.dark }}
                    >
                        {REPORT_STATUSES.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                                {choice.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <Pill className={reportStatusStyle(report.status)}>
                        {reportStatusLabel(report.status)}
                    </Pill>
                )}
            </div>
        </div>
    )
}