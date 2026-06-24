import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import React, { useState } from 'react'
import PickImageComponent from './PickImageComponent'

export default function PassengerProfileForm({ setFormData, onSubmit }) {

    const [address, setAddress] = useState("")
    const [contact_number, setContactNumber] = useState("")
    const [emergency_contact_name, setEmergencyContactName] = useState("")
    const [emergency_contact_number, setEmergencyContactNumber] = useState("")
    const [profile_picture, setProfilePicture] = useState(null)

    const [errors, setErrors] = useState({})

    const validate = () => {
        let newErrors = {}

        // Address
        if (!address || address.trim().length < 5) {
            newErrors.address = "Address must be at least 5 characters"
        }

        // Contact number
        if (!contact_number) {
            newErrors.contact_number = "Contact number is required"
        } else if (!/^\d{11}$/.test(contact_number)) {
            newErrors.contact_number = "Must be exactly 11 digits"
        }

        // Emergency contact name
        if (!emergency_contact_name) {
            newErrors.emergency_contact_name = "Emergency contact name is required"
        }

        // Emergency contact number
        if (!emergency_contact_number) {
            newErrors.emergency_contact_number = "Emergency contact number is required"
        } else if (!/^\d{11}$/.test(emergency_contact_number)) {
            newErrors.emergency_contact_number = "Must be exactly 11 digits"
        } else if (emergency_contact_number === contact_number) {
            newErrors.emergency_contact_number = "Must not be the same as contact number"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = () => {
        if (validate()) {
            const passengerProfile = {
                address,
                contact_number,
                emergency_contact_name,
                emergency_contact_number,
                profile_picture
            }

            setFormData((prev) => {
                const updated = { ...prev, passenger_profile: passengerProfile }
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

    return (
        <ScrollView className={container}>

            <Text className="text-2xl font-bold mb-5 text-center">
                Passenger Profile
            </Text>

            <Text className={label}>Address</Text>
            <TextInput
                className={input}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter address"
            />
            {errors.address && <Text className={errorText}>{errors.address}</Text>}

            <Text className={label}>Contact Number</Text>
            <TextInput
                className={input}
                value={contact_number}
                onChangeText={(text) => setContactNumber(text.replace(/\D/g, ""))}
                placeholder="Enter contact number"
                keyboardType="phone-pad"
            />
            {errors.contact_number && <Text className={errorText}>{errors.contact_number}</Text>}

            <Text className={label}>Emergency Contact Name</Text>
            <TextInput
                className={input}
                value={emergency_contact_name}
                onChangeText={setEmergencyContactName}
                placeholder="Enter emergency contact name"
            />
            {errors.emergency_contact_name && <Text className={errorText}>{errors.emergency_contact_name}</Text>}

            <Text className={label}>Emergency Contact Number</Text>
            <TextInput
                className={input}
                value={emergency_contact_number}
                onChangeText={(text) => setEmergencyContactNumber(text.replace(/\D/g, ""))}
                placeholder="Enter emergency contact number"
                keyboardType="phone-pad"
            />
            {errors.emergency_contact_number && <Text className={errorText}>{errors.emergency_contact_number}</Text>}

            <PickImageComponent
                label="Profile Picture"
                setImage={setProfilePicture}
                image={profile_picture}
            />

            <TouchableOpacity onPress={handleSubmit} className={button}>
                <Text className={buttonText}>Submit Profile</Text>
            </TouchableOpacity>

        </ScrollView>
    )
}