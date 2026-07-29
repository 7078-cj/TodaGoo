import { View, Text, Button, TextInput, TouchableOpacity } from 'react-native'
import React, { useContext, useState } from 'react'
import { Href, router } from "expo-router";
import AuthContext from '@/contexts/AuthContext';


export default function login() {
    const {loginUser, user} = useContext(AuthContext)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [errors, setErrors] = useState({})
    
    const validate = () => {
        let newErrors = {}

        if (!username.trim()) {
            newErrors.username = "username is required"
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

    const handleSubmit = async () => {
        if(validate()){
            const res = await loginUser(username, password)
            if (!res.success){
                console.log(res)
            }else{
                res.user.role == 'passenger' ? router.replace('/(protected)/passenger/home') : router.replace('/(protected)/driver/home')
                
            }
        }
    }

    const handlePress = (destination) => {
        router.push(destination);
    };

    const container = "p-5 bg-white"
    const label = "text-gray-700 mb-1"
    const input = "border border-gray-300 rounded-lg p-3 mb-2"
    const errorText = "text-red-500 mb-2"
    const buttonContainerStyle = "bg-black p-4 rounded-xl mt-3"
    const buttonTextStyle = "text-white text-center font-semibold"

    return (
        <View className={container}>
            <Text>login</Text>

            <Text className={label}>Username</Text>
                <TextInput
                    className={input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter username"
                />
            {errors.username && <Text className={errorText}>{errors.username}</Text>}

            <Text className={label}>Password</Text>
                <TextInput
                    className={input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter address"
                />
            {errors.password && <Text className={errorText}>{errors.password}</Text>}

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