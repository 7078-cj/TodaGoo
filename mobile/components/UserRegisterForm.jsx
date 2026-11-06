import React, { useState } from 'react'
import { normalizeUsername, passwordProblem } from '@/utils/validation'
import FormTextField from './inputs/FormTextField'
import ButtonComponent from '@/components/ButtonComponent'
import RegisterLayout from '@/components/RegisterLayout'

// role: "Passenger" | "Driver" -> header reads "Sign Up As A <role>"
export default function UserRegisterForm({ setPage, setFormData, role }) {
    const [username, setUsername] = useState("")
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [errors, setErrors] = useState({})

    const validate = () => {
        let newErrors = {}

        if (!username.trim()) {
            newErrors.username = "Username is required"
        } else if (username.trim().length < 3) {
            newErrors.username = "Username must be at least 3 characters"
        } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
            newErrors.username = "Username can only contain letters, numbers, and underscores"
        }

        if (!firstName.trim()) newErrors.firstName = "First name is required"
        if (!lastName.trim()) newErrors.lastName = "Last name is required"

        const badPassword = passwordProblem(password)
        if (badPassword) newErrors.password = badPassword

        if (!confirmPassword) {
            newErrors.confirmPassword = "Confirm your password"
        } else if (password !== confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = () => {
        if (validate()) {
            setFormData((prev) => ({
                ...prev,
                username: normalizeUsername(username),
                first_name: firstName,
                last_name: lastName,
                password: password
            }))
            setPage('driver')
        }
    }

    return (
        <RegisterLayout tagline={role ? `Sign Up As A ${role}` : "Sign Up"}>
            <FormTextField
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                error={errors.firstName}
            />

            <FormTextField
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                error={errors.lastName}
            />

            <FormTextField
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                error={errors.username}
            />

            <FormTextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secure
                autoCapitalize="none"
                error={errors.password}
            />

            <FormTextField
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secure
                autoCapitalize="none"
                error={errors.confirmPassword}
            />

            <ButtonComponent label="Next" onPress={handleSubmit} className="mt-8" />
        </RegisterLayout>
    )
}