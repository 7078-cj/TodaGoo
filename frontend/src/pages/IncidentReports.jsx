import React, { useEffect, useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import reportListener from '../listener/reportListener'
import { useSelector } from "react-redux";
import { getIncidentReports } from '../api/incident_reports';
import IncidentReportCard, { reportTitle } from '../components/IncidentReport/IncidentReportCard';
import IncidentReportModal from '../components/IncidentReport/IncidentReportModal';
import MapComponent from '../components/MapComponent';
import Pagination from '../components/Pagination';
import { REPORT_STATUSES } from '../constants/reportStatuses';
import colors from '../constants/colors'; // adjust path

const PAGE_SIZE = 10;

// Adjust these to match the values your backend uses
const INCIDENT_TYPES = [
    { value: "accident", label: "Accident" },
    { value: "overcharging", label: "Overcharging" },
    { value: "reckless_driving", label: "Reckless Driving" },
    { value: "harassment", label: "Harassment" },
    { value: "lost_item", label: "Lost Item" },
    { value: "others", label: "Others" },
]
const SEVERITIES = [
    { value: "minor", label: "Minor" },
    { value: "moderate", label: "Moderate" },
    { value: "severe", label: "Severe" },
]

// Keys match the backend query params: date, incident_types, severity, status
const EMPTY_FILTERS = { date: "", incident_types: "", severity: "", status: "" }

const controlClass = "h-10 rounded-lg border bg-white px-3 text-sm"
const controlStyle = { borderColor: colors.border, color: colors.dark }

export default function IncidentReports() {
    const [reports, setReports] = useState([])
    const [count, setCount] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedReport, setSelectedReport] = useState(null)   // opens the modal
    const [focusedId, setFocusedId] = useState(null)             // highlighted row + map focus
    const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS)
    const [filters, setFilters] = useState(EMPTY_FILTERS)        // applied filters
    const user = useSelector((state) => state.auth.user);

    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

    const fetchReports = async (targetPage = page) => {
        setLoading(true)
        setError(null)
        try {
            // Empty filter values are dropped so the backend only gets what's set
            const params = Object.fromEntries(
                Object.entries({ page: targetPage, ...filters }).filter(([, v]) => v !== "")
            )
            const res = await getIncidentReports(params)
            setReports(res.results ?? [])
            setCount(res.count ?? 0)
        } catch (err) {
            setError(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchReports(page)
    }, [page, filters])

    reportListener(
        user?.department,
        () => console.log('refreshed'),
        setReports
    )

    const handleStatusUpdated = (updatedReport) => {
        setReports((prev) =>
            prev.map((r) => (r.id === updatedReport.id ? updatedReport : r))
        )
        setSelectedReport((prev) =>
            prev && prev.id === updatedReport.id ? updatedReport : prev
        )
    }

    const applyFilters = () => {
        setPage(1)
        setFilters(draftFilters)
    }

    const resetFilters = () => {
        setDraftFilters(EMPTY_FILTERS)
        setPage(1)
        setFilters(EMPTY_FILTERS)
    }

    const handleViewDetails = (report) => {
        setFocusedId(report.id)
        setSelectedReport(report)
    }

    // TODA admins set every status, including "Relayed to MDRRMO"
    const canUpdateReport = () => user?.department === "TODA"

    // Incident pins for the map (only reports that have a location)
    const markers = useMemo(
        () =>
            reports
                .filter((r) => r.location?.lat != null && r.location?.lng != null)
                .map((r) => ({
                    id: r.id,
                    name: reportTitle(r),
                    latitude: r.location.lat,
                    longitude: r.location.lng,
                })),
        [reports]
    )

    // Fly the map to the focused report
    const focusedReport = reports.find((r) => r.id === focusedId)
    const mapLocation = focusedReport?.location
        ? { lat: focusedReport.location.lat, lng: focusedReport.location.lng, full: reportTitle(focusedReport) }
        : null

    const setDraft = (key) => (e) => setDraftFilters((f) => ({ ...f, [key]: e.target.value }))

    return (
        <div className="p-6 space-y-4 min-h-full" style={{ backgroundColor: colors.background }}>
            <h2 className="text-2xl font-bold" style={{ color: colors.text }}>
                Incident Reports
            </h2>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col text-[11px] text-gray-400">
                    Select a date
                    <input
                        type="date"
                        value={draftFilters.date}
                        onChange={setDraft("date")}
                        className={`${controlClass} mt-0.5`}
                        style={controlStyle}
                    />
                </label>

                <select value={draftFilters.incident_types} onChange={setDraft("incident_types")} className={controlClass} style={controlStyle}>
                    <option value="">All Types</option>
                    {INCIDENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                <select value={draftFilters.severity} onChange={setDraft("severity")} className={controlClass} style={controlStyle}>
                    <option value="">All Severity</option>
                    {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                <select value={draftFilters.status} onChange={setDraft("status")} className={controlClass} style={controlStyle}>
                    <option value="">All Status</option>
                    {REPORT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                <button
                    onClick={applyFilters}
                    aria-label="Apply filters"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border bg-white hover:opacity-80"
                    style={controlStyle}
                >
                    <Filter className="h-4 w-4" />
                </button>

                <button
                    onClick={resetFilters}
                    className="h-10 px-2 text-sm hover:underline"
                    style={{ color: colors.secondary }}
                >
                    Clear
                </button>
            </div>

            {/* List + map */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 items-start">
                <div className="space-y-3 lg:col-span-3">
                    {loading ? (
                        <p className="text-gray-500">Loading incident reports…</p>
                    ) : error ? (
                        <p className="text-red-500">Failed to load incident reports.</p>
                    ) : reports.length === 0 ? (
                        <p className="text-gray-500">No incident reports found.</p>
                    ) : (
                        <>
                            {reports.map((report) => (
                                <IncidentReportCard
                                    key={report.id}
                                    report={report}
                                    selected={report.id === focusedId}
                                    canUpdateStatus={canUpdateReport(report)}
                                    onStatusUpdated={handleStatusUpdated}
                                    onViewDetails={handleViewDetails}
                                />
                            ))}

                            <Pagination page={page} setPage={setPage} totalPages={totalPages} />
                        </>
                    )}
                </div>

                <div
                    className="lg:col-span-2 overflow-hidden rounded-2xl border lg:sticky lg:top-4"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                >
                    <h3
                        className="border-b px-4 py-3 text-base font-medium"
                        style={{ color: colors.dark, borderColor: colors.border }}
                    >
                        Incident Map
                    </h3>
                    <div className="h-[420px]">
                        <MapComponent Markers={markers} location={mapLocation} />
                    </div>
                </div>
            </div>

            <IncidentReportModal
                report={selectedReport}
                onClose={() => setSelectedReport(null)}
            />
        </div>
    )
}