import React, { useState } from 'react'
import FormTextField from './inputs/FormTextField'
import PickImageComponent from './inputs/PickImageComponent'
import ButtonComponent from '@/components/ButtonComponent'
import RegisterLayout from '@/components/RegisterLayout'

// formData: the data collected on the previous step (username, password, ...)
export default function PassengerProfileForm({ formData, setFormData, onSubmit }) {

    const [address, setAddress] = useState("")
    const [contact_number, setContactNumber] = useState("")
    const [emergency_contact_name, setEmergencyContactName] = useState("")
    const [emergency_contact_number, setEmergencyContactNumber] = useState("")
    const [profile_picture, setProfilePicture] = useState(null)

    const [errors, setErrors] = useState({})
    const [submitting, setSubmitting] = useState(false)

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

    const handleSubmit = async () => {
        if (submitting || !validate()) return

        const passengerProfile = {
            address,
            contact_number,
            emergency_contact_name,
            emergency_contact_number,
            profile_picture
        }

        // Build the payload from the previous step's data instead of calling
        // onSubmit inside a setState updater (React may run updaters twice).
        const updated = { ...formData, passenger_profile: passengerProfile }
        setFormData(updated)

        setSubmitting(true)
        try {
            await onSubmit(updated)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <RegisterLayout tagline="Sign Up As A Passenger">
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
                label="Emergency Contact Name"
                value={emergency_contact_name}
                onChangeText={setEmergencyContactName}
                autoCapitalize="words"
                error={errors.emergency_contact_name}
            />

            <FormTextField
                label="Emergency Contact Number"
                value={emergency_contact_number}
                onChangeText={(text) => setEmergencyContactNumber(text.replace(/\D/g, ""))}
                keyboardType="phone-pad"
                maxLength={11}
                error={errors.emergency_contact_number}
            />

            <PickImageComponent
                label="Profile Picture"
                setImage={setProfilePicture}
                image={profile_picture}
            />

            <ButtonComponent
                label="Register"
                onPress={handleSubmit}
                loading={submitting}
                className="mt-4"
            />
        </RegisterLayout>
    )
}