import React, { useState } from 'react'
import { updateIncidentReportsStatus } from '../../api/incident_reports';

const STATUS_CHOICES = [
    { value: "open", label: "Open" },
    { value: "resolved", label: "Resolved" },
    { value: "dismissed", label: "Dismissed" },
];

const STATUS_STYLES = {
    open: "bg-amber-100 text-amber-800 ring-amber-600/20",
    resolved: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
    dismissed: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

export default function IncidentReportCard({ report, canUpdateStatus, onStatusUpdated, onViewDetails }) {
    const [updating, setUpdating] = useState(false)
    const [error, setError] = useState(null)

    const handleStatusChange = async (e) => {
        const newStatus = e.target.value
        if (newStatus === report.status) return

        setUpdating(true)
        setError(null)
        try {
            const res = await updateIncidentReportsStatus(report.id, newStatus)
            onStatusUpdated(res.data ?? res ?? { ...report, status: newStatus })
        } catch (err) {
            setError("Failed to update status.")
        } finally {
            setUpdating(false)
        }
    }

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-gray-900">
                        Incident #{report.id}
                    </p>
                    <p className="text-xs text-gray-500">
                        {new Date(report.created_at).toLocaleString()}
                    </p>
                </div>
                <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[report.status] ?? STATUS_STYLES.open}`}
                >
                    {report.status}
                </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Type</p>
                    <p className="text-gray-800 capitalize">{report.incident_types.replace("_", " ")}</p>
                </div>
                <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Injured party</p>
                    <p className="text-gray-800 capitalize">{report.injured_party}</p>
                </div>
            </div>

            {report.details ? (
                <p className="mt-3 text-sm text-gray-600 line-clamp-2">{report.details}</p>
            ) : null}

            {report.evidence?.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                    {report.evidence.slice(0, 4).map((ev) => (
                        <img
                            key={ev.id}
                            src={ev.file}
                            alt="evidence"
                            className="h-14 w-14 rounded-md object-cover border border-gray-200 flex-shrink-0"
                        />
                    ))}
                </div>
            )}

            <button
                onClick={() => onViewDetails(report)}
                className="mt-3 text-xs font-medium text-indigo-600 hover:underline"
            >
                View full details
            </button>

            {canUpdateStatus && (
                <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
                    <label className="text-xs text-gray-500">Status:</label>
                    <select
                        value={report.status}
                        onChange={handleStatusChange}
                        disabled={updating}
                        className="text-sm rounded-md border-gray-300 py-1 pl-2 pr-7 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {STATUS_CHOICES.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                                {choice.label}
                            </option>
                        ))}
                    </select>
                    {updating && <span className="text-xs text-gray-400">Saving…</span>}
                    {error && <span className="text-xs text-red-500">{error}</span>}
                </div>
            )}
        </div>
    )
}