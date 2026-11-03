import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native'
import React, { useEffect, useMemo, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import colors from '../../constants/colors'
import MapComponent from '../map/MapComponent'
import Messages from '../chat/Messages'
import Avatar from '../Avatar'
import { TappablePhoto } from '../PhotoViewer'
import { getPerson } from '../../utils/person'
import formatDateTime from '../../utils/formatDateTime'
import { STATUS_STYLES } from './HistoryCard'

function Section({ title, children, note }) {
    return (
        <View style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.dark }}>{title}</Text>
            {note ? <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{note}</Text> : null}
            <View
                style={{
                    marginTop: 8,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                {children}
            </View>
        </View>
    )
}

function InfoRow({ icon, label, value }) {
    if (value == null || value === "") return null
    return (
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
            <Ionicons name={icon} size={18} color={colors.secondary} />
            <Text style={{ marginLeft: 10, fontSize: 12, color: "#6B7280", width: 90 }}>{label}</Text>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: colors.dark }}>{value}</Text>
        </View>
    )
}

function RoutePoint({ color, label, address, last }) {
    return (
        <View style={{ flexDirection: "row" }}>
            <View style={{ alignItems: "center", width: 22 }}>
                <Ionicons name="location-sharp" size={18} color={color} />
                {!last && <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 }} />}
            </View>
            <View style={{ flex: 1, marginLeft: 6, paddingBottom: last ? 0 : 12 }}>
                <Text style={{ fontSize: 11, color: "#6B7280" }}>{label}</Text>
                <Text style={{ fontSize: 13, color: colors.dark }}>{address || "—"}</Text>
            </View>
        </View>
    )
}

function Stars({ score }) {
    return (
        <View style={{ flexDirection: "row" }}>
            {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons key={n} name={n <= score ? "star" : "star-outline"} size={14} color="#F59E0B" />
            ))}
        </View>
    )
}

// Start, stops, end in the same shape the trip screens give MapComponent
function buildMarkers(booking) {
    if (!booking) return []
    return [
        { id: "start", lat: booking.start?.lat, lng: booking.start?.lng, full: booking.start_address },
        ...(booking.stops ?? []).map((stop) => ({
            id: `stop-${stop.id}`,
            lat: stop.location?.lat,
            lng: stop.location?.lng,
            full: stop.address,
        })),
        { id: "end", lat: booking.end?.lat, lng: booking.end?.lng, full: booking.end_address },
    ]
}

// Full details of a finished ride. The chat log is read-only: the ride is over, so there's no input.
export default function BookingHistoryModal({ booking, visible, onClose, currentUserId, isDriver }) {
    const insets = useSafeAreaInsets()
    const mapRef = useRef(null)

    const markers = useMemo(() => buildMarkers(booking), [booking])
    const route = Array.isArray(booking?.routes) && booking.routes.length > 1 ? booking.routes : null

    // A saved route polyline fits itself into view; without one, fit the start/stop/end pins
    useEffect(() => {
        if (visible && booking && !route) mapRef.current?.fitToContent()
    }, [visible, booking, route])

    if (!booking) return null

    const status = STATUS_STYLES[booking.status] ?? STATUS_STYLES.completed
    const person = getPerson(booking, isDriver)
    const myRating = (booking.ratings ?? []).find((r) => r.rater_id === currentUserId)
    const theirRating = (booking.ratings ?? []).find((r) => r.rated_user_id === currentUserId)
    const stops = booking.stops ?? []

    // Messages groups bubbles by `sender`; history messages carry sender_id
    const messages = (booking.messages ?? []).map((m) => ({ ...m, sender: m.sender_id, receiver: m.receiver_id }))

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.primary,
                        paddingTop: insets.top + 12,
                        paddingBottom: 14,
                        paddingHorizontal: 16,
                    }}
                >
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Close ride details"
                    >
                        <Ionicons name="chevron-back" size={26} color={colors.onPrimary} />
                    </TouchableOpacity>
                    <Text style={{ marginLeft: 12, fontSize: 18, fontWeight: "700", color: colors.onPrimary }}>
                        Ride Details
                    </Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
                    {/* Summary */}
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: status.iconBg,
                                borderRadius: 999,
                                paddingHorizontal: 10,
                                paddingVertical: 3,
                            }}
                        >
                            <Ionicons name={status.icon} size={12} color={colors.onPrimary} />
                            <Text style={{ marginLeft: 4, fontSize: 11, color: colors.onPrimary }}>{status.label}</Text>
                        </View>
                        {booking.type === "special" && (
                            <View
                                style={{
                                    marginLeft: 6,
                                    backgroundColor: colors.primary,
                                    borderRadius: 4,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                }}
                            >
                                <Text style={{ color: colors.onPrimary, fontSize: 10 }}>Priority</Text>
                            </View>
                        )}
                        <View style={{ flex: 1 }} />
                        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.dark }}>₱ {booking.price}</Text>
                    </View>
                    <Text style={{ marginTop: 6, fontSize: 12, color: "#6B7280" }}>
                        Booking #{booking.id} · {formatDateTime(booking.created_at)}
                    </Text>

                    {/* Map: start / stops / end pins, plus the route polyline when it was saved */}
                    <View style={{ height: 220, marginTop: 14, borderRadius: 16, overflow: "hidden" }}>
                        <MapComponent
                            ref={mapRef}
                            markers={markers}
                            route={route}
                            isRoute={false}
                            userLocation={false}
                            editMode={false}
                            canHover={false}
                            centerOnMarkerPress={false}
                        />
                    </View>

                    <Section title="Route">
                        <RoutePoint color={colors.primary} label="Start" address={booking.start_address} />
                        {stops.map((stop, i) => (
                            <RoutePoint key={stop.id} color="#6B7280" label={`Stop ${i + 1}`} address={stop.address} />
                        ))}
                        <RoutePoint color={colors.secondary} label="End" address={booking.end_address} last />
                    </Section>

                    {person && (
                        <Section title={isDriver ? "Passenger" : "Driver"}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                                <TappablePhoto uri={person.photo} accessibilityLabel={`View ${person.name}'s photo`}>
                                    <Avatar uri={person.photo} size={48} />
                                </TappablePhoto>
                                <View style={{ marginLeft: 12, flex: 1 }}>
                                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.dark }}>{person.name}</Text>
                                    {person.rating != null && (
                                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                                            <Ionicons name="star" size={12} color="#F59E0B" />
                                            <Text style={{ marginLeft: 4, fontSize: 12, color: colors.dark }}>
                                                {person.rating.toFixed(2)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <InfoRow icon="call-outline" label="Contact" value={person.phone} />
                            <InfoRow icon="home-outline" label="Address" value={person.address} />
                            <InfoRow icon="pricetag-outline" label="TODA No." value={person.todaNumber} />
                            <InfoRow icon="car-outline" label="Plate No." value={person.plate} />
                        </Section>
                    )}

                    {(myRating || theirRating) && (
                        <Section title="Ratings">
                            {myRating && (
                                <View style={{ paddingVertical: 4 }}>
                                    <Text style={{ fontSize: 12, color: "#6B7280" }}>You gave</Text>
                                    <Stars score={myRating.score} />
                                    {myRating.feedback ? <Text style={{ fontSize: 12, color: colors.dark, marginTop: 2 }}>{myRating.feedback}</Text> : null}
                                </View>
                            )}
                            {theirRating && (
                                <View style={{ paddingVertical: 4 }}>
                                    <Text style={{ fontSize: 12, color: "#6B7280" }}>You received</Text>
                                    <Stars score={theirRating.score} />
                                    {theirRating.feedback ? <Text style={{ fontSize: 12, color: colors.dark, marginTop: 2 }}>{theirRating.feedback}</Text> : null}
                                </View>
                            )}
                        </Section>
                    )}

                    <Section title="Chat log" note="This ride has ended, so the chat is read-only.">
                        <Messages messages={messages} currentUserId={currentUserId} inline emptyText="No messages were sent during this ride." />
                    </Section>
                </ScrollView>
            </View>
        </Modal>
    )
}
