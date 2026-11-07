import { View, Text, TouchableOpacity } from 'react-native'
import KeyboardAvoider from '@/components/layouts/KeyboardAvoider'
import React, { useEffect, useState } from 'react'
import { router } from 'expo-router'
import RegisterLayout from '@/components/RegisterLayout'
import FormTextField from '@/components/inputs/FormTextField'
import ButtonComponent from '@/components/ButtonComponent'
import { requestResetCode, verifyResetCode, setNewPassword } from '@/api/passwordReset'
import { normalizePhone, passwordProblem } from '@/utils/validation'
import formatPhone from '@/utils/formatPhone'

// Forgot password, by SMS code: mobile number -> 6-digit code -> new password -> Login.
// The backend never says whether a number has an account, so the code step always opens after
// "Send code" (unless the number was refused or the request failed).
const DEFAULT_COOLDOWN = 60 // seconds; the server sends the real one as retry_after
const CODE_LENGTH = 6

// utils/requests.js swaps the server's text for a generic one on 429 / 5xx ("Too many attempts...").
// Here the server's own text says what to do ("wait 60 seconds", "try again in an hour",
// "we couldn't send the code"), so show it when there is one.
const messageOf = (res) => ((res.status === 429 || res.status === 503) && res.data?.error) || res.error

export default function ForgotPassword() {
    const [step, setStep] = useState('phone') // 'phone' | 'code' | 'password'
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [resetToken, setResetToken] = useState(null)
    const [errors, setErrors] = useState({})
    const [info, setInfo] = useState('')
    const [loading, setLoading] = useState(false)
    const [cooldown, setCooldown] = useState(0)
    const [tokenExpired, setTokenExpired] = useState(false)

    // resend countdown
    useEffect(() => {
        if (cooldown <= 0) return
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
        return () => clearTimeout(t)
    }, [cooldown])

    const normalized = normalizePhone(phone)

    // "Send code" and "Resend code"
    const sendCode = async () => {
        if (loading) return
        if (!normalized) {
            setErrors({ phone: 'Enter a valid mobile number (e.g. 09123456789)' })
            return
        }
        setErrors({})
        setInfo('')
        setLoading(true)
        try {
            const res = await requestResetCode(normalized)
            const retryAfter = Number(res.data?.retry_after) || 0
            if (res.success) {
                setCooldown(retryAfter || DEFAULT_COOLDOWN)
                setCode('')
                setStep('code')
                setInfo(`We sent a 6-digit code to ${formatPhone(normalized)}.`)
            } else if (res.status === 429 && retryAfter > 0 && retryAfter <= DEFAULT_COOLDOWN * 5) {
                // a code was sent moments ago: go and enter it, resend opens after the wait
                setCooldown(retryAfter)
                setStep('code')
                setErrors({ general: messageOf(res) })
            } else {
                setErrors(step === 'phone' ? { phone: messageOf(res) } : { general: messageOf(res) })
            }
        } finally {
            setLoading(false)
        }
    }

    const verify = async () => {
        if (loading) return
        if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
            setErrors({ code: 'Enter the 6-digit code' })
            return
        }
        setErrors({})
        setLoading(true)
        try {
            const res = await verifyResetCode(normalized, code)
            if (res.success && res.data?.reset_token) {
                setResetToken(res.data.reset_token)
                setInfo('')
                setStep('password')
            } else {
                setErrors({ code: messageOf(res) })
                setCode('')
            }
        } finally {
            setLoading(false)
        }
    }

    const savePassword = async () => {
        if (loading) return
        const newErrors = {}
        const bad = passwordProblem(password)
        if (bad) newErrors.password = bad
        if (!confirmPassword) newErrors.confirmPassword = 'Confirm your password'
        else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
        setErrors(newErrors)
        if (Object.keys(newErrors).length) return

        setLoading(true)
        try {
            const res = await setNewPassword(resetToken, password)
            if (res.success) {
                router.replace({ pathname: '/(global)/login', params: { reset: 'done' } })
                return
            }
            if (res.status === 400 && Array.isArray(res.data?.password)) {
                setErrors({ password: res.data.password[0] })
            } else {
                // expired / used reset session, or the request didn't get through
                setTokenExpired(res.status === 400)
                setErrors({ general: messageOf(res) })
            }
        } finally {
            setLoading(false)
        }
    }

    const startOver = () => {
        setStep('phone')
        setCode('')
        setPassword('')
        setConfirmPassword('')
        setResetToken(null)
        setTokenExpired(false)
        setErrors({})
        setInfo('')
    }

    const general = errors.general ? (
        <Text className="text-error text-xs text-center mt-2">{errors.general}</Text>
    ) : null

    return (
        <KeyboardAvoider className="bg-background">
            <RegisterLayout tagline="Forgot Password">
                {step === 'phone' && (
                    <>
                        <Text className="text-dark text-base mb-4">
                            {"Enter the mobile number on your account. We'll text you a code to reset your password."}
                        </Text>
                        <FormTextField
                            label="Mobile Number"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            placeholder="09XXXXXXXXX"
                            autoCapitalize="none"
                            error={errors.phone}
                        />
                        {general}
                        <ButtonComponent label="Send Code" onPress={sendCode} loading={loading} className="mt-4" />
                    </>
                )}

                {step === 'code' && (
                    <>
                        {info ? <Text className="text-dark text-base mb-4">{info}</Text> : null}
                        <FormTextField
                            label="6-digit Code"
                            value={code}
                            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                            keyboardType="number-pad"
                            maxLength={CODE_LENGTH}
                            autoCapitalize="none"
                            error={errors.code}
                        />
                        {general}
                        <ButtonComponent label="Verify Code" onPress={verify} loading={loading} className="mt-4" />

                        <View className="flex-row justify-between mt-4">
                            <TouchableOpacity onPress={startOver} accessibilityRole="button">
                                <Text className="text-secondary text-sm font-semibold">Change number</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={sendCode}
                                disabled={cooldown > 0 || loading}
                                accessibilityRole="button"
                                accessibilityState={{ disabled: cooldown > 0 || loading }}
                            >
                                <Text className={`text-sm font-semibold ${cooldown > 0 ? 'text-gray-400' : 'text-secondary'}`}>
                                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                {step === 'password' && (
                    <>
                        <Text className="text-dark text-base mb-4">Choose a new password.</Text>
                        <FormTextField
                            label="New Password"
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
                        {general}
                        {tokenExpired ? (
                            <ButtonComponent label="Start Again" onPress={startOver} className="mt-4" />
                        ) : (
                            <ButtonComponent label="Save Password" onPress={savePassword} loading={loading} className="mt-4" />
                        )}
                    </>
                )}

                <TouchableOpacity onPress={() => router.replace('/(global)/login')} className="mt-6 self-center">
                    <Text className="text-primary text-sm">Back to Login</Text>
                </TouchableOpacity>
            </RegisterLayout>
        </KeyboardAvoider>
    )
}
