
import React, { useEffect, useMemo, useState } from 'react'
import { useSelector } from "react-redux"
import reportListener from '../listener/reportListener'
import { getIncidentReports } from '../api/incident_reports'
import IncidentReportCard, { reportTitle } from '../components/IncidentReport/IncidentReportCard'
import IncidentReportModal from '../components/IncidentReport/IncidentReportModal'
import MapComponent from '../components/MapComponent'
import Pagination from '../components/Pagination'
import { REPORT_STATUSES } from '../constants/reportStatuses'
import colors from '../constants/colors'

const PAGE_SIZE = 10
const DEBOUNCE_DELAY = 500

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

const EMPTY_FILTERS = {
    date: "",
    incident_types: "",
    severity: "",
    status: "",
}

const controlClass = "h-10 rounded-lg border bg-white px-3 text-sm"
const controlStyle = {
    borderColor: colors.border,
    color: colors.dark,
}

export default function IncidentReports() {
    const [reports, setReports] = useState([])
    const [count, setCount] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [filtering, setFiltering] = useState(false)
    const [error, setError] = useState(null)

    const [selectedReport, setSelectedReport] = useState(null)
    const [focusedId, setFocusedId] = useState(null)

    const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS)
    const [filters, setFilters] = useState(EMPTY_FILTERS)

    const user = useSelector((state) => state.auth.user)

    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

    // Automatically apply filters after 500ms of inactivity
    useEffect(() => {
        setFiltering(true)

        const timeout = setTimeout(() => {
            setPage(1)
            setFilters(draftFilters)
            setFiltering(false)
        }, DEBOUNCE_DELAY)

        return () => clearTimeout(timeout)
    }, [draftFilters])

    // Fetch reports whenever page or applied filters change
    useEffect(() => {
        let cancelled = false

        const fetchReports = async () => {
            setLoading(true)
            setError(null)

            try {
                const params = Object.fromEntries(
                    Object.entries({
                        page,
                        ...filters,
                    }).filter(([, value]) => value !== "")
                )

                const res = await getIncidentReports(params)

                if (!cancelled) {
                    setReports(res.results ?? [])
                    setCount(res.count ?? 0)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err)
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        fetchReports()

        return () => {
            cancelled = true
        }
    }, [page, filters])

    // Listen for real-time incident report updates
    reportListener(
        user?.department,
        () => console.log('refreshed'),
        setReports
    )

    // Update report after status changes
    const handleStatusUpdated = (updatedReport) => {
        setReports((prev) =>
            prev.map((report) =>
                report.id === updatedReport.id
                    ? updatedReport
                    : report
            )
        )

        setSelectedReport((prev) =>
            prev && prev.id === updatedReport.id
                ? updatedReport
                : prev
        )
    }

    // Reset filters
    const resetFilters = () => {
        setDraftFilters(EMPTY_FILTERS)
    }

    // View report details
    const handleViewDetails = (report) => {
        setFocusedId(report.id)
        setSelectedReport(report)
    }

    // Only TODA admins can update report statuses
    const canUpdateReport = () => user?.department === "TODA"

    // Handle filter changes
    const setDraft = (key) => (e) => {
        setDraftFilters((prev) => ({
            ...prev,
            [key]: e.target.value,
        }))
    }

    // Incident markers for the map
    const markers = useMemo(
        () =>
            reports
                .filter(
                    (report) =>
                        report.location?.lat != null &&
                        report.location?.lng != null
                )
                .map((report) => ({
                    id: report.id,
                    name: reportTitle(report),
                    latitude: report.location.lat,
                    longitude: report.location.lng,
                })),
        [reports]
    )

    // Focused report location
    const focusedReport = reports.find(
        (report) => report.id === focusedId
    )

    const mapLocation = focusedReport?.location
        ? {
            lat: focusedReport.location.lat,
            lng: focusedReport.location.lng,
            full: reportTitle(focusedReport),
        }
        : null

    return (
        <div
            className="min-h-full space-y-4 p-6"
            style={{ backgroundColor: colors.background }}
        >
            <div className="flex items-center justify-between gap-3">
                <h2
                    className="text-2xl font-bold"
                    style={{ color: colors.text }}
                >
                    Incident Reports
                </h2>

                {filtering && (
                    <span className="text-xs text-gray-400">
                        Applying filters...
                    </span>
                )}
            </div>

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

                <select
                    value={draftFilters.incident_types}
                    onChange={setDraft("incident_types")}
                    className={controlClass}
                    style={controlStyle}
                >
                    <option value="">All Types</option>

                    {INCIDENT_TYPES.map((type) => (
                        <option
                            key={type.value}
                            value={type.value}
                        >
                            {type.label}
                        </option>
                    ))}
                </select>

                <select
                    value={draftFilters.severity}
                    onChange={setDraft("severity")}
                    className={controlClass}
                    style={controlStyle}
                >
                    <option value="">All Severity</option>

                    {SEVERITIES.map((severity) => (
                        <option
                            key={severity.value}
                            value={severity.value}
                        >
                            {severity.label}
                        </option>
                    ))}
                </select>

                <select
                    value={draftFilters.status}
                    onChange={setDraft("status")}
                    className={controlClass}
                    style={controlStyle}
                >
                    <option value="">All Status</option>

                    {REPORT_STATUSES.map((status) => (
                        <option
                            key={status.value}
                            value={status.value}
                        >
                            {status.label}
                        </option>
                    ))}
                </select>

                <button
                    onClick={resetFilters}
                    className="h-10 px-2 text-sm hover:underline"
                    style={{ color: colors.secondary }}
                >
                    Clear filters
                </button>
            </div>

            {/* Reports + Map */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
                {/* Incident Reports List */}
                <div className="space-y-3 lg:col-span-3">
                    {loading ? (
                        <p className="text-gray-500">
                            Loading incident reports...
                        </p>
                    ) : error ? (
                        <p className="text-red-500">
                            Failed to load incident reports.
                        </p>
                    ) : reports.length === 0 ? (
                        <p className="text-gray-500">
                            No incident reports found.
                        </p>
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

                            <Pagination
                                page={page}
                                setPage={setPage}
                                totalPages={totalPages}
                            />
                        </>
                    )}
                </div>

                {/* Incident Map */}
                <div
                    className="overflow-hidden rounded-2xl border lg:sticky lg:top-4 lg:col-span-2"
                    style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                    }}
                >
                    <h3
                        className="border-b px-4 py-3 text-base font-medium"
                        style={{
                            color: colors.dark,
                            borderColor: colors.border,
                        }}
                    >
                        Incident Map
                    </h3>

                    <div className="h-[420px]">
                        <MapComponent
                            Markers={markers}
                            location={mapLocation}
                        />
                    </div>
                </div>
            </div>

            {/* Report Details Modal */}
            <IncidentReportModal
                report={selectedReport}
                onClose={() => setSelectedReport(null)}
            />
        </div>
    )
}
