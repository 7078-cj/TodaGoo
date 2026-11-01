import { Modal, View, Text, TouchableOpacity, Image, Pressable, ScrollView, Linking } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import colors from '../constants/colors'

function InfoRow({ icon, label, value }) {
    if (!value) return null
    return (
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
            <Ionicons name={icon} size={20} color={colors.secondary} />
            <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#6B7280" }}>{label}</Text>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.dark }}>{value}</Text>
            </View>
        </View>
    )
}

function VehiclePhoto({ uri, label }) {
    if (!uri) return null
    return (
        <View style={{ flex: 1 }}>
            <Image
                source={{ uri }}
                style={{ width: "100%", height: 110, borderRadius: 12, backgroundColor: "#E5E7EB" }}
                resizeMode="cover"
            />
            <Text style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 4 }}>
                {label}
            </Text>
        </View>
    )
}

export default function PersonDetailsModal({ visible, onClose, person, onMessage }) {
    const insets = useSafeAreaInsets()

    if (!person) return null

    const isDriver = person.role === "driver"
    const hasVehicle = isDriver && (person.vehicleFront || person.vehicleBack)

    const handleCall = () => {
        if (person.phone) Linking.openURL(`tel:${person.phone}`)
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            {/* Dimmed backdrop: tap to close */}
            <Pressable
                onPress={onClose}
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
            >
                {/* Sheet: Pressable stops taps inside from closing */}
                <Pressable
                    onPress={() => {}}
                    style={{
                        maxHeight: "85%",
                        backgroundColor: colors.background,
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        paddingTop: 12,
                    }}
                >
                    {/* Grab handle + close */}
                    <View style={{ alignItems: "center" }}>
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB" }} />
                    </View>

                    <ScrollView
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingTop: 12,
                            paddingBottom: Math.max(insets.bottom, 16) + 8,
                        }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Identity */}
                        <View style={{ alignItems: "center" }}>
                            {person.photo ? (
                                <Image
                                    source={{ uri: person.photo }}
                                    style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#E5E7EB" }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 96,
                                        height: 96,
                                        borderRadius: 48,
                                        backgroundColor: "#E5E7EB",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Ionicons name="person" size={48} color="#9CA3AF" />
                                </View>
                            )}

                            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.dark, marginTop: 10 }}>
                                {person.name}
                            </Text>

                            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                                <View
                                    style={{
                                        borderWidth: 1,
                                        borderColor: colors.secondary,
                                        borderRadius: 999,
                                        paddingHorizontal: 10,
                                        paddingVertical: 2,
                                    }}
                                >
                                    <Text style={{ color: colors.secondary, fontSize: 12 }}>
                                        {isDriver ? "Driver" : "Passenger"}
                                    </Text>
                                </View>

                                {person.rating != null && !Number.isNaN(person.rating) && (
                                    <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 10 }}>
                                        <Ionicons name="star" size={16} color={colors.primary} />
                                        <Text style={{ marginLeft: 4, fontWeight: "600", color: colors.dark }}>
                                            {person.rating.toFixed(1)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Actions */}
                        <View style={{ flexDirection: "row", marginTop: 18 }}>
                            <TouchableOpacity
                                onPress={handleCall}
                                disabled={!person.phone}
                                style={{
                                    flex: 1,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingVertical: 12,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: colors.secondary,
                                    marginRight: 8,
                                    opacity: person.phone ? 1 : 0.4,
                                }}
                            >
                                <Ionicons name="call-outline" size={18} color={colors.secondary} />
                                <Text style={{ marginLeft: 6, color: colors.secondary, fontWeight: "600" }}>Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={onMessage}
                                style={{
                                    flex: 1,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingVertical: 12,
                                    borderRadius: 999,
                                    backgroundColor: colors.secondary,
                                    marginLeft: 8,
                                }}
                            >
                                <Ionicons name="mail-outline" size={18} color={colors.onPrimary} />
                                <Text style={{ marginLeft: 6, color: colors.onPrimary, fontWeight: "600" }}>
                                    Message
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Details */}
                        <View
                            style={{
                                marginTop: 16,
                                backgroundColor: colors.surface,
                                borderRadius: 16,
                                paddingHorizontal: 16,
                                paddingVertical: 4,
                            }}
                        >
                            <InfoRow icon="call-outline" label="Contact number" value={person.phone} />
                            {isDriver ? (
                                <>
                                    <InfoRow icon="bus-outline" label="TODA number" value={person.todaNumber} />
                                    <InfoRow icon="id-card-outline" label="Plate number" value={person.plate} />
                                </>
                            ) : (
                                <InfoRow icon="home-outline" label="Address" value={person.address} />
                            )}
                        </View>

                        {/* Vehicle photos (drivers only) */}
                        {hasVehicle && (
                            <View style={{ marginTop: 16 }}>
                                <Text style={{ fontWeight: "700", color: colors.dark, marginBottom: 8 }}>
                                    Vehicle
                                </Text>
                                <View style={{ flexDirection: "row", gap: 10 }}>
                                    <VehiclePhoto uri={person.vehicleFront} label="Front" />
                                    <VehiclePhoto uri={person.vehicleBack} label="Back" />
                                </View>
                            </View>
                        )}
                    </ScrollView>
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{
                            position: "absolute",
                            right: 16,
                            top: 16,
                            zIndex: 10,
                            elevation: 10, // Android needs elevation for stacking
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: "rgba(0,0,0,0.06)",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Ionicons name="close" size={22} color={colors.dark} />
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    )
}