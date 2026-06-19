import { View, Text, TextInput, TouchableOpacity, Image, ScrollView } from 'react-native'
import React, { useState } from 'react'
import {pickImage} from '../utils/imagePicker'


export default function DriverProfileForm({setFormData, onSubmit}) {

    const [address, setAddress] = useState("")
    const [toda_number, setTodaNumber] = useState("")
    const [franchise_permit_number, setFranchisePermitNumber] = useState("")
    const [license_number, setLicenseNumber] = useState("")
    const [vehicle_plate, setVehiclePlate] = useState("")

    const [profile_picture, setProfilePicture] = useState(null)
    const [vehicle_front_picture, setVehicleFrontPicture] = useState(null)
    const [vehicle_back_picture, setVehicleBackPicture] = useState(null)

    const [errors, setErrors] = useState({})



    const validate = () => {
        let newErrors = {}

        if (!address) newErrors.address = "Address is required"
        if (!toda_number) newErrors.toda_number = "TODA number is required"
        if (!franchise_permit_number) newErrors.franchise_permit_number = "Franchise permit required"
        if (!license_number) newErrors.license_number = "License number is required"
        if (!vehicle_plate) newErrors.vehicle_plate = "Vehicle plate is required"

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = () => {
        if (validate()) {
            const driverProfile = {
                address,
                toda_number,
                franchise_permit_number,
                license_number,
                vehicle_plate,
                profile_picture,
                vehicle_front_picture,
                vehicle_back_picture
            }

            setFormData((prev) => {
                const updated = { ...prev, driver_profile: driverProfile }
                onSubmit(updated)
                return updated
            })
        }
    }

    const container = "p-5 bg-white"
    const label = "text-gray-700 mb-1"
    const input = "border border-gray-300 rounded-lg p-3 mb-2"
    const errorText = "text-red-500 mb-2"
    const button = "bg-black p-4 rounded-xl mt-3"
    const buttonText = "text-white text-center font-semibold"
    const imageBox = "w-full h-40 rounded-lg mb-2 bg-gray-100 justify-center items-center"

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
            {errors.address && <Text className={errorText}>{errors.address}</Text>}

            <Text className={label}>TODA Number</Text>
            <TextInput
                className={input}
                value={toda_number}
                onChangeText={setTodaNumber}
                placeholder="Enter TODA number"
            />
            {errors.toda_number && <Text className={errorText}>{errors.toda_number}</Text>}

            <Text className={label}>Franchise Permit Number</Text>
            <TextInput
                className={input}
                value={franchise_permit_number}
                onChangeText={setFranchisePermitNumber}
                placeholder="Enter permit number"
            />
            {errors.franchise_permit_number && <Text className={errorText}>{errors.franchise_permit_number}</Text>}

            <Text className={label}>License Number</Text>
            <TextInput
                className={input}
                value={license_number}
                onChangeText={setLicenseNumber}
                placeholder="Enter license number"
            />
            {errors.license_number && <Text className={errorText}>{errors.license_number}</Text>}

            <Text className={label}>Vehicle Plate</Text>
            <TextInput
                className={input}
                value={vehicle_plate}
                onChangeText={setVehiclePlate}
                placeholder="Enter plate number"
            />
            {errors.vehicle_plate && <Text className={errorText}>{errors.vehicle_plate}</Text>}

            <Text className={label}>Profile Picture</Text>
            <TouchableOpacity
                onPress={() => pickImage(setProfilePicture)}
                className={imageBox}
            >
                {profile_picture ? (
                    <Image source={{ uri: profile_picture.uri }} className="w-full h-full rounded-lg" />
                ) : (
                    <Text className="text-gray-500">Upload Profile Image</Text>
                )}
            </TouchableOpacity>

            <Text className={label}>Vehicle Front</Text>
            <TouchableOpacity
                onPress={() => pickImage(setVehicleFrontPicture)}
                className={imageBox}
            >
                {vehicle_front_picture ? (
                    <Image source={{ uri: vehicle_front_picture.uri }} className="w-full h-full rounded-lg" />
                ) : (
                    <Text className="text-gray-500">Upload Front Image</Text>
                )}
            </TouchableOpacity>

            <Text className={label}>Vehicle Back</Text>
            <TouchableOpacity
                onPress={() => pickImage(setVehicleBackPicture)}
                className={imageBox}
            >
                {vehicle_back_picture ? (
                    <Image source={{ uri: vehicle_back_picture.uri }} className="w-full h-full rounded-lg" />
                ) : (
                    <Text className="text-gray-500">Upload Back Image</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSubmit} className={button}>
                <Text className={buttonText}>Submit Profile</Text>
            </TouchableOpacity>

        </ScrollView>
    )
}