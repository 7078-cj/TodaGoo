import { View, Text, TextInput, TouchableOpacity, Image, ScrollView } from 'react-native'
import React, { useState } from 'react'
import * as ImagePicker from "expo-image-picker"

export default function DriverProfileForm() {


    const [address, setAddress] = useState("")
    const [todaNumber, setTodaNumber] = useState("")
    const [franchisePermitNumber, setFranchisePermitNumber] = useState("")
    const [licenseNumber, setLicenseNumber] = useState("")
    const [vehiclePlate, setVehiclePlate] = useState("")

    const [profilePicture, setProfilePicture] = useState(null)
    const [vehicleFrontPicture, setVehicleFrontPicture] = useState(null)
    const [vehicleBackPicture, setVehicleBackPicture] = useState(null)

    const [errors, setErrors] = useState({})


    const pickImage = async (setImage) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        })

        if (!result.canceled) {
            setImage(result.assets[0].uri)
        }
    }


    const validate = () => {
        let newErrors = {}

        if (!address) newErrors.address = "Address is required"
        if (!todaNumber) newErrors.todaNumber = "TODA number is required"
        if (!franchisePermitNumber) newErrors.franchisePermitNumber = "Franchise permit required"
        if (!licenseNumber) newErrors.licenseNumber = "License number is required"
        if (!vehiclePlate) newErrors.vehiclePlate = "Vehicle plate is required"

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = () => {
        if (validate()) {
            console.log("Driver Profile Valid ✅")
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

            {/* ADDRESS */}
            <Text className={label}>Address</Text>
            <TextInput
                className={input}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter address"
            />
            {errors.address && <Text className={errorText}>{errors.address}</Text>}

            {/* TODA NUMBER */}
            <Text className={label}>TODA Number</Text>
            <TextInput
                className={input}
                value={todaNumber}
                onChangeText={setTodaNumber}
                placeholder="Enter TODA number"
            />
            {errors.todaNumber && <Text className={errorText}>{errors.todaNumber}</Text>}

            {/* FRANCHISE */}
            <Text className={label}>Franchise Permit Number</Text>
            <TextInput
                className={input}
                value={franchisePermitNumber}
                onChangeText={setFranchisePermitNumber}
                placeholder="Enter permit number"
            />
            {errors.franchisePermitNumber && <Text className={errorText}>{errors.franchisePermitNumber}</Text>}

            {/* LICENSE */}
            <Text className={label}>License Number</Text>
            <TextInput
                className={input}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder="Enter license number"
            />
            {errors.licenseNumber && <Text className={errorText}>{errors.licenseNumber}</Text>}

            {/* VEHICLE PLATE */}
            <Text className={label}>Vehicle Plate</Text>
            <TextInput
                className={input}
                value={vehiclePlate}
                onChangeText={setVehiclePlate}
                placeholder="Enter plate number"
            />
            {errors.vehiclePlate && <Text className={errorText}>{errors.vehiclePlate}</Text>}

            {/* PROFILE PICTURE */}
            <Text className={label}>Profile Picture</Text>
            <TouchableOpacity
                onPress={() => pickImage(setProfilePicture)}
                className={imageBox}
            >
                {profilePicture ? (
                    <Image source={{ uri: profilePicture }} className="w-full h-full rounded-lg" />
                ) : (
                    <Text className="text-gray-500">Upload Profile Image</Text>
                )}
            </TouchableOpacity>

            {/* VEHICLE FRONT */}
            <Text className={label}>Vehicle Front</Text>
            <TouchableOpacity
                onPress={() => pickImage(setVehicleFrontPicture)}
                className={imageBox}
            >
                {vehicleFrontPicture ? (
                    <Image source={{ uri: vehicleFrontPicture }} className="w-full h-full rounded-lg" />
                ) : (
                    <Text className="text-gray-500">Upload Front Image</Text>
                )}
            </TouchableOpacity>

            {/* VEHICLE BACK */}
            <Text className={label}>Vehicle Back</Text>
            <TouchableOpacity
                onPress={() => pickImage(setVehicleBackPicture)}
                className={imageBox}
            >
                {vehicleBackPicture ? (
                    <Image source={{ uri: vehicleBackPicture }} className="w-full h-full rounded-lg" />
                ) : (
                    <Text className="text-gray-500">Upload Back Image</Text>
                )}
            </TouchableOpacity>

            {/* SUBMIT */}
            <TouchableOpacity onPress={handleSubmit} className={button}>
                <Text className={buttonText}>Submit Profile</Text>
            </TouchableOpacity>

        </ScrollView>
    )
}