import { View, Text, TouchableOpacity } from 'react-native'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { getMyReports, getReport } from '../../api/report'
import { useReportRequest, clearReportRequest } from '../../utils/reportRequestStore'
import colors from '../../constants/colors'
import {
    REPORT_STATUSES, INCIDENT_TYPE_ICONS, INCIDENT_TYPE_LABELS, formatReportId,
} from '../../constants/reports'
import { HERO_GREEN } from './ProfileHero'
import ReportDetailsModal from './ReportDetailsModal'
import { ErrorState } from '../feedback'
import { LoadingScreen } from '../../components/loading';
import { LOADING_MESSAGES } from '../../constants/loading';

const FILTERS = [{ key: "all", label: "All Reports" }, ...REPORT_STATUSES.map((s) => ({ key: s.status, label: s.label }))]

function FilterPills({ value, onChange }) {
    return (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {FILTERS.map((f) => {
                const active = f.key === value
                return (
                    <TouchableOpacity
                        key={f.key}
                        onPress={() => onChange(f.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        style={{
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: active ? HERO_GREEN : "#9CA3AF",
                            backgroundColor: active ? HERO_GREEN : colors.surface,
                        }}
                    >
                        <Text style={{ fontSize: 12, color: active ? colors.onPrimary : colors.dark }}>{f.label}</Text>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

function ReportCard({ report, onPress }) {
    const status = REPORT_STATUSES.find((s) => s.status === report.status)
    const icon = INCIDENT_TYPE_ICONS[report.incident_types] ?? INCIDENT_TYPE_ICONS.default

    return (
        <TouchableOpacity
            onPress={() => onPress(report)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Report ${formatReportId(report.id)} details`}
            style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 12,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.border,
            }}
        >
            <View style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1.5, borderColor: colors.error, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={icon} size={18} color={colors.error} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.dark }}>
                    {INCIDENT_TYPE_LABELS[report.incident_types] ?? report.incident_types}
                </Text>
                <Text style={{ fontSize: 11, color: "#6B7280" }}>{formatReportId(report.id)}</Text>
            </View>
            {status && (
                <View style={{ backgroundColor: status.color, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, color: colors.onPrimary }}>{status.label}</Text>
                </View>
            )}
        </TouchableOpacity>
    )
}

// Reports the user filed (the backend only returns your own)
export default function ReportsTab() {
    const [reports, setReports] = useState(null)
    const [filter, setFilter] = useState("all")
    const [error, setError] = useState(null)
    const [selected, setSelected] = useState(null)
    const reportRequest = useReportRequest()

    // A tapped report notification: open that report (always your own). It comes from the list,
    // or is fetched if it's not on the first page.
    useEffect(() => {
        if (!reportRequest) return
        let cancelled = false
        ;(async () => {
            try {
                const report =
                    (reports ?? []).find((r) => r.id === reportRequest.reportId) ?? (await getReport(reportRequest.reportId))
                if (!cancelled) setSelected(report)
            } catch (err) {
                if (!cancelled) {
                    setError(err.message)
                    clearReportRequest()
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [reportRequest, reports])

    const closeReport = () => {
        setSelected(null)
        clearReportRequest()
    }

    const load = useCallback(async () => {
        try {
            setReports(await getMyReports())
            setError(null)
        } catch (err) {
            setError(err.message)
        }
    }, [])

    useFocusEffect(
        useCallback(() => {
            load()
        }, [load])
    )

    const visible = useMemo(
        () => (filter === "all" ? reports ?? [] : (reports ?? []).filter((r) => r.status === filter)),
        [reports, filter]
    )

    return (
        <View style={{ padding: 16 }}>
            <FilterPills value={filter} onChange={setFilter} />

            {reports === null && !error ? (
                <LoadingScreen fill={false} message={LOADING_MESSAGES.reports} style={{ marginTop: 8 }} />
            ) : error && reports === null ? (
                <ErrorState fill={false} message={error} onRetry={load} />
            ) : visible.length === 0 ? (
                <Text style={{ color: "#6B7280", textAlign: "center", marginTop: 16 }}>No reports here.</Text>
            ) : (
                visible.map((report) => <ReportCard key={report.id} report={report} onPress={setSelected} />)
            )}

            {selected && <ReportDetailsModal report={selected} onClose={closeReport} />}
        </View>
    )
}
