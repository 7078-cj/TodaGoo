import React, { useEffect, useState } from 'react'
import reportListener from '../listener/reportListener'
import { useSelector } from "react-redux";
import { getIncidentReports } from '../api/incident_reports';
import IncidentReportCard from '../components/IncidentReport/IncidentReportCard';
import IncidentReportModal from '../components/IncidentReport/IncidentReportModal';
import Pagination from '../components/Pagination';

const ADMIN_DEPARTMENTS = ["TODA", "MDRRMO"];
const PAGE_SIZE = 10;

export default function IncidentReports() {
    const [reports, setReports] = useState([])
    const [count, setCount] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedReport, setSelectedReport] = useState(null)
    const user = useSelector((state) => state.auth.user);

    const isAdmin = ADMIN_DEPARTMENTS.includes(user?.department)
    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

    const fetchReports = async (targetPage = page) => {
        setLoading(true)
        setError(null)
        try {
            const res = await getIncidentReports({ page: targetPage })
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
    }, [page])

    reportListener(
        user?.department,
        () => fetchReports(page),
        () => fetchReports(page)
    )

    const handleStatusUpdated = (updatedReport) => {
        setReports((prev) =>
            prev.map((r) => (r.id === updatedReport.id ? updatedReport : r))
        )
        setSelectedReport((prev) =>
            prev && prev.id === updatedReport.id ? updatedReport : prev
        )
    }

    const canUpdateReport = (report) => {
        if (user?.department === "TODA") return true
        if (user?.department === "MDRRMO") {
            return ["accident", "reckless_driving", "others"].includes(report.incident_types)
        }
        return false
    }

    if (loading) return <div className="p-6 text-gray-500">Loading incident reports…</div>
    if (error) return <div className="p-6 text-red-500">Failed to load incident reports.</div>

    return (
        <div className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Incident Reports</h2>

            {reports.length === 0 ? (
                <p className="text-gray-500">No incident reports found.</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {reports.map((report) => (
                            <IncidentReportCard
                                key={report.id}
                                report={report}
                                canUpdateStatus={canUpdateReport(report)}
                                onStatusUpdated={handleStatusUpdated}
                                onViewDetails={setSelectedReport}
                            />
                        ))}
                    </div>

                    <Pagination page={page} setPage={setPage} totalPages={totalPages} />
                </>
            )}

            <IncidentReportModal
                report={selectedReport}
                onClose={() => setSelectedReport(null)}
            />
        </div>
    )
}