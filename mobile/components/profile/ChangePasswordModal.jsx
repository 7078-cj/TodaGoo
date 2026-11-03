import { Modal, Text, TouchableOpacity, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import React, { useContext, useEffect, useMemo, useState } from 'react'
import FormTextField from '../inputs/FormTextField'
import colors from '../../constants/colors'
import AuthContext from '../../contexts/AuthContext'
import { changePassword, saveTokens } from '../../api/auth'
import { getPasswordChangeMethod } from '../../constants/passwordChange'
import { HERO_GREEN } from './ProfileHero'

const firstError = (value) => (Array.isArray(value) ? value[0] : value)

// Step 1 (verification) comes from constants/passwordChange.js, so a different method (e.g. OTP)
// only changes that config; step 2 (new password + confirm) stays the same.
// Render it only while open (`{open && <ChangePasswordModal />}`) so every opening starts empty.
export default function ChangePasswordModal({ onClose }) {
    const { setToken, setUser } = useContext(AuthContext)
    const method = useMemo(() => getPasswordChangeMethod(), [])

    const [form, setForm] = useState(() =>
        Object.fromEntries([...method.fields.map((f) => [f.name, ""]), ["new_password", ""], ["confirm_password", ""]])
    )
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)

    // send a code first if the method needs one (e.g. OTP)
    useEffect(() => {
        method.requestCode?.().catch((err) => setErrors({ general: err.message }))
    }, [method])

    const set = (name) => (value) => setForm((prev) => ({ ...prev, [name]: value }))

    const handleSubmit = async () => {
        const nextErrors = {}
        method.fields.forEach((f) => {
            if (!form[f.name]) nextErrors[f.name] = `${f.label} is required.`
        })
        if (!form.new_password) nextErrors.new_password = "New password is required."
        else if (form.new_password !== form.confirm_password) nextErrors.confirm_password = "Passwords don't match."

        setErrors(nextErrors)
        if (Object.keys(nextErrors).length) return

        // verification fields are sent as-is, so the backend verifier decides what they mean
        const { confirm_password, ...body } = form

        setSaving(true)
        try {
            const res = await changePassword(body)
            if (!res.success) {
                const data = res.data ?? {}
                setErrors({
                    ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firstError(value)])),
                    general: data.detail ?? (res.status === 429 ? "Too many attempts. Please try again later." : undefined),
                })
                return
            }

            // other sessions were signed out; keep this one with the new tokens
            await saveTokens({ access: res.data.access, refresh: res.data.refresh }, setToken, setUser)
            onClose()
            Alert.alert("Password changed", "Your password was updated. Other devices have been signed out.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <Pressable
                        onPress={() => {}}
                        style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 }}
                    >
                        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.dark }}>Change Password</Text>

                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.dark, marginTop: 14 }}>{method.title}</Text>
                        <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{method.description}</Text>
                        {method.fields.map((f) => (
                            <FormTextField
                                key={f.name}
                                label={f.label}
                                value={form[f.name]}
                                onChangeText={set(f.name)}
                                error={errors[f.name]}
                                secure={!!f.secure}
                                keyboardType={f.keyboardType ?? "default"}
                                autoCapitalize="none"
                            />
                        ))}

                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.dark, marginTop: 6, marginBottom: 8 }}>New password</Text>
                        <FormTextField label="New Password" value={form.new_password} onChangeText={set("new_password")} error={errors.new_password} secure autoCapitalize="none" />
                        <FormTextField label="Confirm New Password" value={form.confirm_password} onChangeText={set("confirm_password")} error={errors.confirm_password} secure autoCapitalize="none" />

                        {errors.general ? <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>{errors.general}</Text> : null}

                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={saving}
                            style={{ backgroundColor: HERO_GREEN, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 6, opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Update Password</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{ borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 10, borderWidth: 1, borderColor: "#9CA3AF" }}
                        >
                            <Text style={{ color: "#6B7280" }}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </KeyboardAvoidingView>
            </Pressable>
        </Modal>
    )
}
