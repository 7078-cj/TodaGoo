import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import React, { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FormTextField from "./inputs/FormTextField";
import PickImageComponent from "./inputs/PickImageComponent";
import AutoAttachedInfo from "./reports/AutoAttachedInfo";
import { getLocation } from "../utils/location";
import { submitIncidentReport } from "../api/report";
import { INCIDENT_TYPE_LABELS, REPORT_TAGS } from "../constants/reports";
import colors from "../constants/colors";

const TAG_GREEN = "#0F5A4A";

// "Who is Injured": the reporter's own role is "Me (...)"
const injuredOptions = (isDriver) => [
    { key: isDriver ? "driver" : "passenger", label: isDriver ? "Me (Driver)" : "Me (Passenger)" },
    { key: isDriver ? "passenger" : "driver", label: isDriver ? "Passenger" : "Driver" },
    { key: "others", label: "Others" },
    { key: "none", label: "None" },
];

function SectionTitle({ children }) {
    return <Text style={{ fontSize: 16, fontWeight: "600", color: colors.dark, marginTop: 20, marginBottom: 8 }}>{children}</Text>;
}

function OptionRow({ label, selected, onPress, kind }) {
    const icon =
        kind === "radio"
            ? selected ? "radio-button-on" : "radio-button-off"
            : selected ? "checkbox" : "square-outline";
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole={kind === "radio" ? "radio" : "checkbox"}
            accessibilityState={{ checked: selected }}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5 }}
        >
            <Ionicons name={icon} size={20} color={selected ? TAG_GREEN : colors.dark} />
            <Text style={{ marginLeft: 8, fontSize: 14, color: colors.dark }}>{label}</Text>
        </TouchableOpacity>
    );
}

// Full-screen "Report an Incident" form. `booking` fills the auto-attached card;
// `bookingId` is still accepted for older callers.
export default function IncidentReportModal({ visible, onClose, onSubmit = null, booking = null, bookingId, isDriver = false }) {
    const insets = useSafeAreaInsets();
    const [incidentType, setIncidentType] = useState(null);
    const [injuredParty, setInjuredParty] = useState("none");
    const [tags, setTags] = useState([]);
    const [details, setDetails] = useState("");
    const [images, setImages] = useState([]);
    const [error, setError] = useState("");
    const [location, setLocation] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const resetForm = () => {
        setIncidentType(null);
        setInjuredParty("none");
        setTags([]);
        setDetails("");
        setImages([]);
        setError("");
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const toggleTag = (key) =>
        setTags((current) => (current.includes(key) ? current.filter((t) => t !== key) : [...current, key]));

    const handleSubmit = async () => {
        if (!incidentType) {
            setError("Please select the type of incident.");
            return;
        }
        if (!location) {
            setError("Still getting your location. Please wait a moment and try again.");
            return;
        }
        setError("");
        setSubmitting(true);
        try {
            const res = await submitIncidentReport({
                incident_types: incidentType,
                injured_party: injuredParty,
                tags,
                details,
                evidence_files: images,
                location,
                booking_id: booking?.id ?? bookingId,
            });

            if (res.success) {
                onSubmit && onSubmit();
                handleClose();
            } else {
                setError(res.error || "Failed to submit the report. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        if (!visible) return;
        (async () => {
            const loc = await getLocation({});
            if (!loc) {
                setError("Unable to get your location. Please make sure location services are on.");
                return;
            }
            setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        })();
    }, [visible]);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* header */}
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
                        onPress={handleClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Close report form"
                    >
                        <Ionicons name="chevron-back" size={26} color={colors.onPrimary} />
                    </TouchableOpacity>
                    <Text style={{ marginLeft: 12, fontSize: 20, fontWeight: "600", color: colors.onPrimary }}>Report an Incident</Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
                    <AutoAttachedInfo booking={booking} location={location} />

                    <SectionTitle>Type of Incident</SectionTitle>
                    {Object.entries(INCIDENT_TYPE_LABELS).map(([key, label]) => (
                        <OptionRow key={key} kind="checkbox" label={label} selected={incidentType === key} onPress={() => setIncidentType(key)} />
                    ))}

                    <SectionTitle>Who is Injured</SectionTitle>
                    {injuredOptions(isDriver).map(({ key, label }) => (
                        <OptionRow key={key} kind="radio" label={label} selected={injuredParty === key} onPress={() => setInjuredParty(key)} />
                    ))}

                    <SectionTitle>Tags</SectionTitle>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {REPORT_TAGS.map(({ key, label }) => {
                            const active = tags.includes(key);
                            return (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => toggleTag(key)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: active }}
                                    style={{
                                        paddingVertical: 6,
                                        paddingHorizontal: 14,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? TAG_GREEN : colors.dark,
                                        backgroundColor: active ? TAG_GREEN : "transparent",
                                    }}
                                >
                                    <Text style={{ fontSize: 13, color: active ? colors.onPrimary : colors.dark }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <SectionTitle>What Happened</SectionTitle>
                    <FormTextField
                        label="Details"
                        value={details}
                        onChangeText={setDetails}
                        placeholder="Describe what happened..."
                        multiline
                    />

                    <PickImageComponent
                        label="Evidence Photos"
                        multiple
                        images={images}
                        setImages={setImages}
                        maxImages={5}
                    />

                    {error ? <Text style={{ color: colors.error, marginBottom: 8 }}>{error}</Text> : null}

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={submitting}
                        accessibilityRole="button"
                        style={{
                            backgroundColor: colors.error,
                            borderRadius: 999,
                            paddingVertical: 14,
                            alignItems: "center",
                            marginTop: 8,
                            opacity: submitting ? 0.7 : 1,
                        }}
                    >
                        {submitting ? (
                            <ActivityIndicator color={colors.onPrimary} />
                        ) : (
                            <Text style={{ color: colors.onPrimary, fontWeight: "600", fontSize: 16 }}>Submit Report</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
}
