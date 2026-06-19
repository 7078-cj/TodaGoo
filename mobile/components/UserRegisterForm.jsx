import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'

export default function UserRegisterForm({setPage,setFormData}) {

    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [errors, setErrors] = useState({})

    const validate = () => {
        let newErrors = {}

        if (!firstName.trim()) newErrors.firstName = "First name is required"
        if (!lastName.trim()) newErrors.lastName = "Last name is required"

        if (!email.trim()) {
            newErrors.email = "Email is required"
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = "Invalid email format"
        }

        if (!password) {
            newErrors.password = "Password is required"
        } else if (password.length < 6) {
            newErrors.password = "Minimum 6 characters"
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
                firstName: firstName,
                lastName: lastName,
                email: email,
                password: password
            }))
            setPage('driver')
        }
        
    }


    const containerStyle = "flex-1 bg-white p-5 justify-center"

    const titleTextStyle = "text-2xl font-bold mb-5 text-center"

    const fieldLabelStyle = "mb-1 text-gray-700"

    const inputBaseStyle = "border border-gray-300 rounded-lg p-3 mb-1"

    const inputErrorStyle = "border-red-500"

    const errorTextStyle = "text-red-500 mb-2"

    const buttonContainerStyle = "bg-black p-4 rounded-xl mt-3"

    const buttonTextStyle = "text-white text-center font-semibold"

    return (
        <View className={containerStyle}>

            <Text className={titleTextStyle}>
                Register
            </Text>

            {/* First Name */}
            <Text className={fieldLabelStyle}>First Name</Text>
            <TextInput
                className={`${inputBaseStyle} ${errors.firstName ? inputErrorStyle : ""}`}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
            />
            {errors.firstName && (
                <Text className={errorTextStyle}>{errors.firstName}</Text>
            )}

            {/* Last Name */}
            <Text className={fieldLabelStyle}>Last Name</Text>
            <TextInput
                className={`${inputBaseStyle} ${errors.lastName ? inputErrorStyle : ""}`}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
            />
            {errors.lastName && (
                <Text className={errorTextStyle}>{errors.lastName}</Text>
            )}

            {/* Email */}
            <Text className={fieldLabelStyle}>Email</Text>
            <TextInput
                className={`${inputBaseStyle} ${errors.email ? inputErrorStyle : ""}`}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email"
                keyboardType="email-address"
            />
            {errors.email && (
                <Text className={errorTextStyle}>{errors.email}</Text>
            )}

            {/* Password */}
            <Text className={fieldLabelStyle}>Password</Text>
            <TextInput
                className={`${inputBaseStyle} ${errors.password ? inputErrorStyle : ""}`}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secureTextEntry
            />
            {errors.password && (
                <Text className={errorTextStyle}>{errors.password}</Text>
            )}

            {/* Confirm Password */}
            <Text className={fieldLabelStyle}>Confirm Password</Text>
            <TextInput
                className={`${inputBaseStyle} ${errors.confirmPassword ? inputErrorStyle : ""}`}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                secureTextEntry
            />
            {errors.confirmPassword && (
                <Text className={errorTextStyle}>{errors.confirmPassword}</Text>
            )}

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