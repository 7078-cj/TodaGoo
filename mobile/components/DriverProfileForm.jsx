import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import React, { useState } from "react";
import PickImageComponent from "./PickImageComponent";

export default function DriverProfileForm({ setFormData, onSubmit }) {
    const [address, setAddress] = useState("");
    const [contact_number, setContactNumber] = useState("");
    const [toda_number, setTodaNumber] = useState("");
    const [franchise_permit_number, setFranchisePermitNumber] = useState("");
    const [license_number, setLicenseNumber] = useState("");
    const [vehicle_plate, setVehiclePlate] = useState("");

    const [profile_picture, setProfilePicture] = useState(null);
    const [vehicle_front_picture, setVehicleFrontPicture] = useState(null);
    const [vehicle_back_picture, setVehicleBackPicture] = useState(null);

    const [errors, setErrors] = useState({});

    const validate = () => {
        let newErrors = {};

        // Address
        if (!address || address.trim().length < 5) {
            newErrors.address = "Address must be at least 5 characters";
        }

        // Contact number
        if (!contact_number) {
            newErrors.contact_number = "Contact number is required";
        } else if (!/^\d{11}$/.test(contact_number)) {
            newErrors.contact_number = "Must be exactly 11 digits";
        }

        // TODA number
        const todaPattern = /^(0[1-9]|1[01])-\d{3}$/;

        if (!toda_number) {
            newErrors.toda_number = "TODA number is required";
        } else if (!todaPattern.test(toda_number)) {
            newErrors.toda_number =
                "Format must be 01-XXX to 11-XXX (e.g., 01-123 or 10-400)";
        }

        // Franchise permit
        if (
            !franchise_permit_number ||
            franchise_permit_number.trim().length < 5
        ) {
            newErrors.franchise_permit_number =
                "Franchise permit must be at least 5 characters";
        }

        // License number
        if (!license_number || license_number.trim().length < 6) {
            newErrors.license_number =
                "License number must be at least 6 characters";
        }

        // Vehicle plate
        const platePattern = /^[A-Z]{2,3}[- ]?\d{3,4}$/i;
        if (!vehicle_plate) {
            newErrors.vehicle_plate = "Vehicle plate is required";
        } else if (!platePattern.test(vehicle_plate)) {
            newErrors.vehicle_plate =
                "Invalid plate format (e.g., ABC1234)";
        }

        // Images
        if (!profile_picture) {
            newErrors.profile_picture = "Profile picture is required";
        }

        if (!vehicle_front_picture) {
            newErrors.vehicle_front_picture =
                "Vehicle front image is required";
        }

        if (!vehicle_back_picture) {
            newErrors.vehicle_back_picture =
                "Vehicle back image is required";
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
                franchise_permit_number,
                license_number,
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
    const label = "text-gray-700 mb-1";
    const input = "border border-gray-300 rounded-lg p-3 mb-2";
    const errorText = "text-red-500 mb-2";
    const button = "bg-black p-4 rounded-xl mt-3";
    const buttonText = "text-white text-center font-semibold";

    return (
        <ScrollView className={container}>
            <Text className="text-2xl font-bold mb-5 text-center">
                Driver Profile
            </Text>

            <Text className={label}>Address</Text>
            <TextInput
                className={input}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter address"
            />
            {errors.address && (
                <Text className={errorText}>{errors.address}</Text>
            )}

            <Text className={label}>Contact Number</Text>
            <TextInput
                className={input}
                value={contact_number}
                onChangeText={(text) =>
                    setContactNumber(text.replace(/\D/g, ""))
                }
                placeholder="Enter contact number"
                keyboardType="phone-pad"
                maxLength={11}
            />
            {errors.contact_number && (
                <Text className={errorText}>
                    {errors.contact_number}
                </Text>
            )}

            <Text className={label}>TODA Number</Text>
            <TextInput
                className={input}
                value={toda_number}
                onChangeText={(text) =>
                    setTodaNumber(text.replace(/\s/g, ""))
                }
                placeholder="e.g. 10-400"
            />
            {errors.toda_number && (
                <Text className={errorText}>{errors.toda_number}</Text>
            )}

            <Text className={label}>Franchise Permit Number</Text>
            <TextInput
                className={input}
                value={franchise_permit_number}
                onChangeText={setFranchisePermitNumber}
                placeholder="Enter permit number"
            />
            {errors.franchise_permit_number && (
                <Text className={errorText}>
                    {errors.franchise_permit_number}
                </Text>
            )}

            <Text className={label}>License Number</Text>
            <TextInput
                className={input}
                value={license_number}
                onChangeText={setLicenseNumber}
                placeholder="Enter license number"
            />
            {errors.license_number && (
                <Text className={errorText}>
                    {errors.license_number}
                </Text>
            )}

            <Text className={label}>Vehicle Plate</Text>
            <TextInput
                className={input}
                value={vehicle_plate}
                onChangeText={(text) =>
                    setVehiclePlate(text.toUpperCase())
                }
                placeholder="e.g. ABC1234"
            />
            {errors.vehicle_plate && (
                <Text className={errorText}>
                    {errors.vehicle_plate}
                </Text>
            )}

            <PickImageComponent
                label="Profile Picture"
                setImage={setProfilePicture}
                image={profile_picture}
            />
            {errors.profile_picture && (
                <Text className={errorText}>
                    {errors.profile_picture}
                </Text>
            )}

            <PickImageComponent
                label="Vehicle Front"
                setImage={setVehicleFrontPicture}
                image={vehicle_front_picture}
            />
            {errors.vehicle_front_picture && (
                <Text className={errorText}>
                    {errors.vehicle_front_picture}
                </Text>
            )}

            <PickImageComponent
                label="Vehicle Back"
                setImage={setVehicleBackPicture}
                image={vehicle_back_picture}
            />
            {errors.vehicle_back_picture && (
                <Text className={errorText}>
                    {errors.vehicle_back_picture}
                </Text>
            )}

            <TouchableOpacity
                onPress={handleSubmit}
                className={button}
            >
                <Text className={buttonText}>Submit Profile</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}