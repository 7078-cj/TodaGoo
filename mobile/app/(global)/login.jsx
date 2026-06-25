import { View, Text, Button } from 'react-native'
import React, { useState } from 'react'
import { Href, router } from "expo-router";


export default function login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [errors, setErrors] = useState({})
    
    const validate = () => {
        let newErrors = {}

        if (!email.trim()) {
            newErrors.email = "Email is required"
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = "Invalid email format"
        }

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

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = () => {
        
    }

    const handlePress = (destination) => {
        router.push(destination);
    };

    const container = "p-5 bg-white"
    const label = "text-gray-700 mb-1"
    const input = "border border-gray-300 rounded-lg p-3 mb-2"
    const errorText = "text-red-500 mb-2"
    const button = "bg-black p-4 rounded-xl mt-3"
    const buttonText = "text-white text-center font-semibold"

    return (
        <View className={container}>
            <Text>login</Text>

            <Text className={label}>Email</Text>
                <TextInput
                    className={input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter Email"
                />
            {errors.email && <Text className={errorText}>{errors.email}</Text>}

            <Text className={label}>Password</Text>
                <TextInput
                    className={input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter address"
                />
            {errors.email && <Text className={errorText}>{errors.email}</Text>}

            <TouchableOpacity
                onPress={handleSubmit}
                className={buttonContainerStyle}
            >
                <Text className={buttonTextStyle}>
                    Login
                </Text>
            </TouchableOpacity>            

            <Button
                title="Register as Driver"
                onPress={() => handlePress("/(global)/register/driver")}
            />

            <Button
                title="Register as Passenger"
                onPress={() => handlePress("/(global)/register/passenger")}
            />
        </View>
    )
}