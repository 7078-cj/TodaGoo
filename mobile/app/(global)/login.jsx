import { View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Keyboard, Platform } from 'react-native'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { router } from "expo-router";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthContext from '@/contexts/AuthContext';
import AuthHeader from '@/components/AuthHeader';          // adjust paths
import ButtonComponent from '@/components/ButtonComponent';
import FormTextField from '@/components/inputs/FormTextField';
import LoginIllustration from '@/assets/Login.svg';

export default function login() {
    const { loginUser } = useContext(AuthContext)
    const insets = useSafeAreaInsets()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [errors, setErrors] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const scrollRef = useRef(null)

    // When the keyboard opens, scroll down so the inputs and Login button stay visible
    useEffect(() => {
        const sub = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
        )
        return () => sub.remove()
    }, [])

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
        if (submitting || !validate()) return

        setSubmitting(true)
        try {
            const res = await loginUser(username, password)
            if (!res.success) {
                console.log(res)
                setErrors({ general: "Invalid username or password." })
            } else {
                res.user.role == 'passenger'
                    ? router.replace('/(protected)/passenger/home')
                    : router.replace('/(protected)/driver/home')
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-background"
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
            >
                {/* overflow-hidden keeps the oversized header circle clipped on Android */}
                <View className="flex-1 overflow-hidden" style={{ paddingBottom: insets.bottom + 24 }}>
                    <AuthHeader tagline="Sign In and Continue" />

                    <View className="items-center mt-6 mb-4 px-8">
                        <LoginIllustration width="100%" height={350} />
                    </View>

                    <View className="px-8">
                        <FormTextField
                            label="Username"
                            value={username}
                            onChangeText={setUsername}
                            error={errors.username}
                            placeholder="Enter username"
                            autoCapitalize="none"
                        />

                        <FormTextField
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            error={errors.password}
                            placeholder="Enter password"
                            secure
                            autoCapitalize="none"
                        />

                        {errors.general ? (
                            <Text className="text-error text-xs text-center mt-1">
                                {errors.general}
                            </Text>
                        ) : null}

                        <ButtonComponent
                            label="Login"
                            onPress={handleSubmit}
                            loading={submitting}
                            className="mt-6"
                        />

                        <View className="flex-row justify-center mt-4">
                            <Text className="text-primary text-base">Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.push("/(global)/choose_a_role")}>
                                <Text className="text-secondary text-base font-semibold">Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}