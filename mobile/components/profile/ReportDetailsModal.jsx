import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView, Image } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import colors from '../../constants/colors'
import { INCIDENT_TYPE_LABELS, INJURED_PARTY_LABELS, REPORT_STATUSES } from '../../constants/reports'
import { formatDate } from '../../utils/formatDateTime'
import formatCoordinates from '../../utils/formatCoordinates'
import formatPhone from '../../utils/formatPhone'
import { mediaUrl } from '../../utils/person'
import { TappablePhoto } from '../PhotoViewer'
import { HERO_GREEN } from './ProfileHero'

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "")
const fullName = (p) => [p?.first_name, p?.last_name].filter(Boolean).map(cap).join(" ") || p?.username || ""

function Row({ label, value, italic = false, last = false }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                borderBottomWidth: last ? 0 : 1,
                borderBottomColor: colors.border,
            }}
        >
            <Text style={{ fontSize: 12, color: colors.dark }}>{label}</Text>
            <Text
                style={{ flex: 1, marginLeft: 12, textAlign: "right", fontSize: 12, fontWeight: "700", color: colors.dark, fontStyle: italic ? "italic" : "normal" }}
            >
                {value || "—"}
            </Text>
        </View>
    )
}

function SectionTitle({ children }) {
    return <Text style={{ fontSize: 15, fontWeight: "600", color: colors.dark, marginTop: 20, marginBottom: 4 }}>{children}</Text>
}

function TextBox({ title, text, placeholder, backgroundColor, borderColor }) {
    return (
        <View style={{ marginTop: 14, backgroundColor, borderWidth: 1, borderColor, borderRadius: 6, padding: 10, minHeight: 80 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.dark, marginBottom: 4 }}>{title}</Text>
            <Text style={{ fontSize: 13, color: text ? colors.dark : "#6B7280", fontStyle: text ? "normal" : "italic" }}>
                {text || placeholder}
            </Text>
        </View>
    )
}

// Report details from Profile → Reports. Closes with the X, the back button, or a tap outside.
export default function ReportDetailsModal({ report, onClose }) {
    if (!report) return null

    const booking = report.booking ?? {}
    const driver = booking.driver
    const passenger = booking.passenger
    const evidence = report.evidence ?? []
    const status = REPORT_STATUSES.find((s) => s.status === report.status)
    const closedLabel = report.status === "dismissed" ? "Dismissed" : "Resolved"

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
                {/* Backdrop sits behind the card (not around it), so the card's ScrollView gets its touches */}
                <Pressable
                    onPress={onClose}
                    accessibilityLabel="Close report details"
                    style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }}
                />

                <View style={{ maxHeight: "90%", borderRadius: 14, overflow: "hidden", backgroundColor: colors.background }}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: HERO_GREEN, paddingHorizontal: 16, paddingVertical: 14 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", color: colors.onPrimary, letterSpacing: 0.5 }}>REPORT DETAILS</Text>
                        <TouchableOpacity
                            onPress={onClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel="Close report details"
                        >
                            <Ionicons name="close-circle-outline" size={26} color={colors.onPrimary} />
                        </TouchableOpacity>
                    </View>

                    {/* flexShrink: lets the ScrollView fit inside the card's maxHeight and scroll the rest */}
                    <ScrollView
                        style={{ flexShrink: 1 }}
                        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                        showsVerticalScrollIndicator
                        nestedScrollEnabled
                    >
                        {/* Auto-attached information */}
                        <View style={{ backgroundColor: "#F3F4F6", borderRadius: 12, padding: 10 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, marginLeft: 4 }}>
                                <Ionicons name="location-outline" size={16} color={colors.dark} />
                                <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: "600", color: colors.dark }}>Auto-Attached Information</Text>
                            </View>
                            <View style={{ backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12 }}>
                                <Row label="GPS Location:" value={formatCoordinates(report.location)} />
                                <Row label="Route:" value={booking.start_address && `${booking.start_address} → ${booking.end_address}`} />
                                <Row label="Driver:" value={driver && `${fullName(driver)}${driver.vehicle_plate ? ` (${driver.vehicle_plate})` : ""}`} />
                                <Row
                                    label="Passenger:"
                                    value={passenger && `${fullName(passenger)}${passenger.contact_number ? ` (${formatPhone(passenger.contact_number)})` : ""}`}
                                    last
                                />
                            </View>
                        </View>

                        <SectionTitle>INCIDENT INFORMATION</SectionTitle>
                        <Row label="Incident Type:" value={INCIDENT_TYPE_LABELS[report.incident_types] ?? report.incident_types} />
                        <Row label="Who was involved:" value={INJURED_PARTY_LABELS[report.injured_party] ?? report.injured_party} italic />
                        <Row label="Evidence:" value={evidence.length ? `${evidence.length} photo${evidence.length === 1 ? "" : "s"}` : "None"} last={!evidence.length} />
                        {evidence.length > 0 && (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 10 }}>
                                {evidence.map((item) => {
                                    const uri = mediaUrl(item.file)
                                    return (
                                        <TappablePhoto key={item.id} uri={uri} accessibilityLabel="View evidence photo">
                                            <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: "#E5E7EB" }} />
                                        </TappablePhoto>
                                    )
                                })}
                            </View>
                        )}

                        <SectionTitle>TIMELINE</SectionTitle>
                        <Row label="Submitted:" value={formatDate(report.created_at)} />
                        <Row
                            label={report.resolved_at ? `${closedLabel}:` : "Status:"}
                            value={report.resolved_at ? formatDate(report.resolved_at) : status?.label ?? report.status}
                            last
                        />

                        <TextBox
                            title="WHAT HAPPENED"
                            text={report.details}
                            placeholder="No details were given."
                            backgroundColor="#F3F4F6"
                            borderColor="#D1D5DB"
                        />
                        <TextBox
                            title="Resolution"
                            text={report.resolution}
                            placeholder={report.resolved_at ? "No resolution note was added." : "Not resolved yet."}
                            backgroundColor="#DFF3DC"
                            borderColor="#B7DDB0"
                        />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    )
}
