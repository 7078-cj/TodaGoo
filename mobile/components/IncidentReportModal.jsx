import { Modal, View, Text, TouchableOpacity, ScrollView } from "react-native";
import React, { useState, useEffect } from "react";
import FormTextField from "./inputs/FormTextField";
import PickImageComponent from "./inputs/PickImageComponent";
import { getLocation } from "../utils/location";
import { submitIncidentReport } from "../api/report";

const INCIDENT_TYPES = {
    accident: "Accident",
    overcharging: "Overcharging",
    reckless_driving: "Reckless Driving",
    harassment: "Harassment",
    lost_item: "Lost Item",
    others: "Others",
};

const INJURED_PARTIES = {
    passenger: "Me (Passenger)",
    driver: "Driver",
    others: "Others",
    none: "None",
};

export default function IncidentReportModal({ visible, onClose, onSubmit = null, submitting = false, bookingId }) {
    const [incidentType, setIncidentType] = useState(null);
    const [injuredParty, setInjuredParty] = useState("none");
    const [details, setDetails] = useState("");
    const [images, setImages] = useState([]);
    const [error, setError] = useState("");
    const [location, setLocation] = useState(null);

    const resetForm = () => {
        setIncidentType(null);
        setInjuredParty("none");
        setDetails("");
        setImages([]);
        setError("");
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async() => {
        if (!incidentType) {
            setError("Please select an incident type.");
            return;
        }
        setError("");
        const res = await submitIncidentReport({
            incident_types: incidentType,
            injured_party: injuredParty,
            details,
            evidence_files: images,
            location,
        });

        if (res.success) {
            onSubmit && onSubmit();
            handleClose();
        }else {
            setError("Failed to submit the report. Please try again.");
        }
    };

    const chipStyle = (active) =>
        `px-3 py-2 rounded-full mr-2 mb-2 border ${
            active ? "bg-red-500 border-red-500" : "bg-white border-gray-300"
        }`;

    const chipTextStyle = (active) => (active ? "text-white" : "text-gray-700");

    const handleLocationFetch = async () => {
        const loc = await getLocation({ setLocation, setError });

        if (!loc) {
            console.error("No location available, cannot submit report");
            setError("Unable to fetch location. Please ensure location services are enabled.");
        }

        setLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude
        });

        
    };

    useEffect(() => {
        handleLocationFetch();
    }, []);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
            <View className="flex-1 justify-end bg-black/40">
                <View className="bg-white rounded-t-2xl p-4 max-h-[85%]">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-semibold">Report an Incident</Text>
                        <TouchableOpacity onPress={handleClose}>
                            <Text className="text-gray-500 text-base">Close</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text className="text-gray-700 mb-1">Incident Type</Text>
                        <View className="flex-row flex-wrap mb-3">
                            {Object.entries(INCIDENT_TYPES).map(([key, label]) => (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => setIncidentType(key)}
                                    className={chipStyle(incidentType === key)}
                                >
                                    <Text className={chipTextStyle(incidentType === key)}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text className="text-gray-700 mb-1">Who was injured?</Text>
                        <View className="flex-row flex-wrap mb-3">
                            {Object.entries(INJURED_PARTIES).map(([key, label]) => (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => setInjuredParty(key)}
                                    className={chipStyle(injuredParty === key)}
                                >
                                    <Text className={chipTextStyle(injuredParty === key)}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <FormTextField
                            label="Details"
                            value={details}
                            onChangeText={setDetails}
                            placeholder="Describe what happened..."
                        />

                        <PickImageComponent
                            label="Evidence Photos"
                            multiple
                            images={images}
                            setImages={setImages}
                            maxImages={5}
                        />

                        {error ? <Text className="text-red-500 mb-2">{error}</Text> : null}

                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={submitting}
                            className={`rounded-lg p-3 items-center mt-2 mb-6 ${
                                submitting ? "bg-red-300" : "bg-red-500"
                            }`}
                        >
                            <Text className="text-white font-semibold">
                                {submitting ? "Submitting..." : "Submit Report"}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}