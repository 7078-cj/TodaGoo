import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import React, { useState, useEffect, useRef } from "react";
import PickImageComponent from "./inputs/PickImageComponent";
import { getTodaStations } from "../api/toda";
import PickTodaStation from "./PickTodaStation";
import FormTextField from "./inputs/FormTextField";

const DEBOUNCE_MS = 400;

export default function DriverProfileForm({ setFormData, onSubmit }) {
    const [address, setAddress] = useState("");
    const [contact_number, setContactNumber] = useState("");
    const [toda_number, setTodaNumber] = useState("");
    const [vehicle_plate, setVehiclePlate] = useState("");

    const [profile_picture, setProfilePicture] = useState(null);
    const [vehicle_front_picture, setVehicleFrontPicture] = useState(null);
    const [vehicle_back_picture, setVehicleBackPicture] = useState(null);

    const [todaStations, setTodaStations] = useState([]);
    const [selectedStation, setSelectedStation] = useState(null);
    const [loadingStations, setLoadingStations] = useState(false);
    const [stationsError, setStationsError] = useState(null);

    const lastFetchedPrefix = useRef(null);
    const debounceTimer = useRef(null);
    const lastRequestId = useRef(0);

    const [errors, setErrors] = useState({});

    const prefix = toda_number.slice(0, 2);
    const prefixIsComplete = /^\d{2}$/.test(prefix);

    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = null;
        }

        if (!prefixIsComplete) {
            setTodaStations([]);
            setSelectedStation(null);
            setLoadingStations(false);
            setStationsError(null);
            lastFetchedPrefix.current = null;
            return;
        }

        if (lastFetchedPrefix.current === prefix) return;

        const requestId = ++lastRequestId.current;

        debounceTimer.current = setTimeout(async () => {
            setLoadingStations(true);
            setStationsError(null);

            try {
                const res = await getTodaStations(prefix);
                const data = res?.data ?? res;

                if (requestId === lastRequestId.current) {
                    setTodaStations(data ?? []);
                    setSelectedStation(null);
                    lastFetchedPrefix.current = prefix;
                }
            } catch (err) {
                console.error("Error fetching TODA stations:", err);
                if (requestId === lastRequestId.current) {
                    setStationsError("Failed to load stations for this TODA number.");
                    setTodaStations([]);
                }
            } finally {
                if (requestId === lastRequestId.current) {
                    setLoadingStations(false);
                }
            }
        }, DEBOUNCE_MS);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                debounceTimer.current = null;
            }
        };
    }, [prefix, prefixIsComplete]);

    const validate = () => {
        let newErrors = {};

        if (!address || address.trim().length < 5) {
            newErrors.address = "Address must be at least 5 characters";
        }

        if (!contact_number) {
            newErrors.contact_number = "Contact number is required";
        } else if (!/^\d{11}$/.test(contact_number)) {
            newErrors.contact_number = "Must be exactly 11 digits";
        }

        const todaPattern = /^(0[1-9]|1[01])-\d{3}$/;
        if (!toda_number) {
            newErrors.toda_number = "TODA number is required";
        } else if (!todaPattern.test(toda_number)) {
            newErrors.toda_number =
                "Format must be 01-XXX to 11-XXX (e.g., 01-123 or 10-400)";
        }

        if (!selectedStation) {
            newErrors.toda_station = "Please select a TODA station";
        }

        const platePattern = /^[A-Z]{2,3}[- ]?\d{3,4}$/i;
        if (!vehicle_plate) {
            newErrors.vehicle_plate = "Vehicle plate is required";
        } else if (!platePattern.test(vehicle_plate)) {
            newErrors.vehicle_plate = "Invalid plate format (e.g., ABC1234)";
        }

        if (!profile_picture) {
            newErrors.profile_picture = "Profile picture is required";
        }

        if (!vehicle_front_picture) {
            newErrors.vehicle_front_picture = "Vehicle front image is required";
        }

        if (!vehicle_back_picture) {
            newErrors.vehicle_back_picture = "Vehicle back image is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            const driverProfile = {
                address,
                contact_number,
                toda_number,
                toda_station: selectedStation.id,
                vehicle_plate,
                profile_picture,
                vehicle_front_picture,
                vehicle_back_picture,
            };

            setFormData((prev) => {
                const updated = {
                    ...prev,
                    driver_profile: driverProfile,
                };

                onSubmit(updated);
                return updated;
            });
        }
    };

    const container = "p-5 bg-white";
    const button = "bg-black p-4 rounded-xl mt-3";
    const buttonText = "text-white text-center font-semibold";

    return (
        <ScrollView className={container}>
            <Text className="text-2xl font-bold mb-5 text-center">
                Driver Profile
            </Text>

            <FormTextField
                label="Address"
                value={address}
                onChangeText={setAddress}
                placeholder="Enter address"
                error={errors.address}
            />

            <FormTextField
                label="Contact Number"
                value={contact_number}
                onChangeText={(text) => setContactNumber(text.replace(/\D/g, ""))}
                placeholder="Enter contact number"
                keyboardType="phone-pad"
                maxLength={11}
                error={errors.contact_number}
            />

            <FormTextField
                label="TODA Number"
                value={toda_number}
                onChangeText={(text) => setTodaNumber(text.replace(/\s/g, ""))}
                placeholder="e.g. 10-400"
                error={errors.toda_number}
            />

            {prefixIsComplete && (
                <PickTodaStation
                    stations={todaStations}
                    loading={loadingStations}
                    error={stationsError}
                    onSelect={setSelectedStation}
                />
            )}
            {errors.toda_station && (
                <Text className="text-red-500 mb-2">{errors.toda_station}</Text>
            )}

            <FormTextField
                label="Vehicle Plate"
                value={vehicle_plate}
                onChangeText={(text) => setVehiclePlate(text.toUpperCase())}
                placeholder="e.g. ABC1234"
                error={errors.vehicle_plate}
            />

            <PickImageComponent
                label="Profile Picture"
                setImage={setProfilePicture}
                image={profile_picture}
            />
            {errors.profile_picture && (
                <Text className="text-red-500 mb-2">{errors.profile_picture}</Text>
            )}

            <PickImageComponent
                label="Vehicle Front"
                setImage={setVehicleFrontPicture}
                image={vehicle_front_picture}
            />
            {errors.vehicle_front_picture && (
                <Text className="text-red-500 mb-2">{errors.vehicle_front_picture}</Text>
            )}

            <PickImageComponent
                label="Vehicle Back"
                setImage={setVehicleBackPicture}
                image={vehicle_back_picture}
            />
            {errors.vehicle_back_picture && (
                <Text className="text-red-500 mb-2">{errors.vehicle_back_picture}</Text>
            )}

            <TouchableOpacity onPress={handleSubmit} className={button}>
                <Text className={buttonText}>Submit Profile</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}