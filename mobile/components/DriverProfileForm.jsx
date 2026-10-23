import { Text } from "react-native";
import React, { useState, useEffect, useRef } from "react";
import PickImageComponent from "./inputs/PickImageComponent";
import { getTodaStations } from "../api/toda";
import PickTodaStation from "./PickTodaStation";
import FormTextField from "./inputs/FormTextField";
import ButtonComponent from "@/components/ButtonComponent";
import RegisterLayout from "@/components/RegisterLayout";

const DEBOUNCE_MS = 400;

// formData: the data collected on the previous step (username, password, ...)
export default function DriverProfileForm({ formData, setFormData, onSubmit }) {
    const [address, setAddress] = useState("");
    const [contact_number, setContactNumber] = useState("");
    const [toda_number, setTodaNumber] = useState("");
    const [franchise_permit_number, setFranchisePermitNumber] = useState("");
    const [license_number, setLicenseNumber] = useState("");
    const [vehicle_plate, setVehiclePlate] = useState("");

    const [license_id_picture, setLicenseIdPicture] = useState(null);
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
    const [submitting, setSubmitting] = useState(false);

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

        if (!franchise_permit_number.trim()) {
            newErrors.franchise_permit_number = "Franchise permit number is required";
        }

        if (!license_number.trim()) {
            newErrors.license_number = "License number is required";
        }

        const platePattern = /^[A-Z]{2,3}[- ]?\d{3,4}$/i;
        if (!vehicle_plate) {
            newErrors.vehicle_plate = "Vehicle plate is required";
        } else if (!platePattern.test(vehicle_plate)) {
            newErrors.vehicle_plate = "Invalid plate format (e.g., ABC1234)";
        }

        if (!license_id_picture) {
            newErrors.license_id_picture = "License ID image is required";
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

    const handleSubmit = async () => {
        if (submitting || !validate()) return;

        const driverProfile = {
            address,
            contact_number,
            toda_number,
            toda_station: selectedStation.id,
            franchise_permit_number: franchise_permit_number.trim(),
            license_number: license_number.trim(),
            vehicle_plate,
            license_id_picture,
            profile_picture,
            vehicle_front_picture,
            vehicle_back_picture,
        };

        // Build the payload from the previous step's data instead of calling
        // onSubmit inside a setState updater (React may run updaters twice).
        const updated = { ...formData, driver_profile: driverProfile };
        setFormData(updated);

        setSubmitting(true);
        try {
            await onSubmit(updated);
        } finally {
            setSubmitting(false);
        }
    };

    const imageError = "text-error text-xs -mt-2 mb-3";

    return (
        <RegisterLayout tagline="Sign Up As A Driver">
            <FormTextField
                label="Address"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="words"
                error={errors.address}
            />

            <FormTextField
                label="Contact Number"
                value={contact_number}
                onChangeText={(text) => setContactNumber(text.replace(/\D/g, ""))}
                keyboardType="phone-pad"
                maxLength={11}
                error={errors.contact_number}
            />

            <FormTextField
                label="Toda Number"
                value={toda_number}
                onChangeText={(text) => setTodaNumber(text.replace(/\s/g, ""))}
                placeholder="e.g. 10-400"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
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
                <Text className="text-error text-xs mb-3">{errors.toda_station}</Text>
            )}

            <FormTextField
                label="Franchise Permit Number"
                value={franchise_permit_number}
                onChangeText={setFranchisePermitNumber}
                autoCapitalize="characters"
                error={errors.franchise_permit_number}
            />

            <FormTextField
                label="License Number"
                value={license_number}
                onChangeText={setLicenseNumber}
                autoCapitalize="characters"
                error={errors.license_number}
            />

            <FormTextField
                label="Vehicle Plate"
                value={vehicle_plate}
                onChangeText={(text) => setVehiclePlate(text.toUpperCase())}
                placeholder="e.g. ABC1234"
                autoCapitalize="characters"
                error={errors.vehicle_plate}
            />

            <PickImageComponent
                label="License ID"
                setImage={setLicenseIdPicture}
                image={license_id_picture}
            />
            {errors.license_id_picture && (
                <Text className={imageError}>{errors.license_id_picture}</Text>
            )}

            <PickImageComponent
                label="Profile Picture"
                setImage={setProfilePicture}
                image={profile_picture}
                facing="front"
            />
            {errors.profile_picture && (
                <Text className={imageError}>{errors.profile_picture}</Text>
            )}

            <PickImageComponent
                label="Vehicle Front"
                setImage={setVehicleFrontPicture}
                image={vehicle_front_picture}
            />
            {errors.vehicle_front_picture && (
                <Text className={imageError}>{errors.vehicle_front_picture}</Text>
            )}

            <PickImageComponent
                label="Vehicle Back"
                setImage={setVehicleBackPicture}
                image={vehicle_back_picture}
            />
            {errors.vehicle_back_picture && (
                <Text className={imageError}>{errors.vehicle_back_picture}</Text>
            )}

            <ButtonComponent
                label="Register"
                onPress={handleSubmit}
                loading={submitting}
                className="mt-4"
            />
        </RegisterLayout>
    );
}