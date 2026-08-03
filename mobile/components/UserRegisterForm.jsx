import { View, Text, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
import { normalizeUsername } from '@/utils/validation'
import FormTextField from './inputs/FormTextField'

export default function UserRegisterForm({ setPage, setFormData }) {

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

        if (!password) {
            newErrors.password = "Password is required"
        } else if (password.length < 8) {
            newErrors.password = "Minimum 8 characters"
        } else if (!/[A-Z]/.test(password)) {
            newErrors.password = "Must contain at least 1 uppercase letter"
        } else if (!/[0-9]/.test(password)) {
            newErrors.password = "Must contain at least 1 number"
        } else if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\];'`~/\\]/.test(password)) {
            newErrors.password = "Must contain at least 1 special character"
        }

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

    const containerStyle = "flex-1 bg-white p-5 justify-center"
    const titleTextStyle = "text-2xl font-bold mb-5 text-center"
    const buttonContainerStyle = "bg-black p-4 rounded-xl mt-3"
    const buttonTextStyle = "text-white text-center font-semibold"

    return (
        <View className={containerStyle}>

            <Text className={titleTextStyle}>
                Register
            </Text>

            <FormTextField
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="Enter Username"
                autoCapitalize="none"
                error={errors.username}
            />

            <FormTextField
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                error={errors.firstName}
            />

            <FormTextField
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                error={errors.lastName}
            />

            <FormTextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secure
                error={errors.password}
            />

            <FormTextField
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                secure
                error={errors.confirmPassword}
            />

            {/* Button */}
            <TouchableOpacity
                onPress={handleSubmit}
                className={buttonContainerStyle}
            >
                <Text className={buttonTextStyle}>
                    Register
                </Text>
            </TouchableOpacity>

        </View>
    )
}