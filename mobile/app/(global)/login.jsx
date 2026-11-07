import { View, Text, TouchableOpacity } from 'react-native'
import React, { useContext, useState } from 'react'
import KeyboardAvoider from '@/components/layouts/KeyboardAvoider';
import KeyboardAwareScrollView, { useKeyboardVisible } from '@/components/layouts/KeyboardAwareScrollView';
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { passwordProblem } from '@/utils/validation';
import AuthContext from '@/contexts/AuthContext';
import AuthHeader from '@/components/AuthHeader';          // adjust paths
import ButtonComponent from '@/components/ButtonComponent';
import FormTextField from '@/components/inputs/FormTextField';
import LoginIllustration from '@/assets/Login.svg';

export default function Login() {
    const { loginUser } = useContext(AuthContext)
    const insets = useSafeAreaInsets()
    // ?reset=done: back from Forgot Password with a new password
    const { reset } = useLocalSearchParams()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [errors, setErrors] = useState({})
    const [submitting, setSubmitting] = useState(false)
    // while typing, a smaller illustration leaves the fields and the Login button room
    const keyboardOpen = useKeyboardVisible()

    const validate = () => {
        let newErrors = {}

        if (!username.trim()) {
            newErrors.username = "username is required"
        }

        const badPassword = passwordProblem(password)
        if (badPassword) newErrors.password = badPassword

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (submitting || !validate()) return

        setSubmitting(true)
        try {
            const res = await loginUser(username, password)
            if (!res.success) {
                // wrong details get one message; no connection / server trouble say so instead
                const wrongDetails = res.kind === "auth" || res.kind === "validation"
                setErrors({ general: wrongDetails ? "Invalid username or password." : res.error })
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
        <KeyboardAvoider className="bg-background">
            {/* the focused field scrolls above the keyboard (with room for the next one / the button) */}
            <KeyboardAwareScrollView
                extraSpace={120}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
            >
                {/* overflow-hidden keeps the oversized header circle clipped on Android */}
                <View className="flex-1 overflow-hidden" style={{ paddingBottom: insets.bottom + 24 }}>
                    <AuthHeader tagline="Sign In and Continue" />

                    <View className="items-center mt-6 mb-4 px-8">
                        <LoginIllustration width="100%" height={keyboardOpen ? 160 : 350} />
                    </View>

                    <View className="px-8">
                        {reset === "done" ? (
                            <Text className="text-success text-sm text-center mb-3">
                                Password updated. Log in with your new password.
                            </Text>
                        ) : null}

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

                        <TouchableOpacity
                            onPress={() => router.push("/(global)/forgot_password")}
                            className="self-end"
                            accessibilityRole="link"
                        >
                            <Text className="text-secondary text-sm font-semibold">Forgot password?</Text>
                        </TouchableOpacity>

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
                            <Text className="text-primary text-base">{"Don't have an account? "}</Text>
                            <TouchableOpacity onPress={() => router.push("/(global)/choose_a_role")}>
                                <Text className="text-secondary text-base font-semibold">Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAwareScrollView>
        </KeyboardAvoider>
    )
}