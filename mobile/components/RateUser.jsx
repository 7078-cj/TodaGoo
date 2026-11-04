import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native'
import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { createRate } from '../api/rate'
import Avatar from './Avatar'
import colors from '../constants/colors'

const GREEN = "#0F5A4A"
const STAR_ON = "#F59E0B"
const STAR_OFF = "#D1D5DB"

const firstError = (value) => (Array.isArray(value) ? value[0] : value)

// Rate the other person after a ride: a driver rates the passenger, a passenger rates the driver.
// person: { name, photo, rating } (utils/person getPerson). onDone runs after Submit or Skip.
export default function RateUser({ bookingId, ratedUserId, person, onDone }) {
    const [score, setScore] = useState(0)
    const [feedback, setFeedback] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState({})

    const handleSubmit = async () => {
        if (score < 1) {
            setErrors({ score: 'Tap a star to rate from 1 to 5.' })
            return
        }

        setSubmitting(true)
        setErrors({})
        try {
            await createRate({
                booking_id: bookingId,
                user_id: ratedUserId,
                score,
                feedback: feedback.trim() || null,
            })
            onDone?.()
        } catch (err) {
            const data = err?.data
            if (data && typeof data === 'object' && Object.keys(data).length) {
                const mapped = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, firstError(v)]))
                // e.g. "You have already rated this booking" comes back as non_field_errors / a list
                setErrors({ ...mapped, general: mapped.non_field_errors ?? mapped.detail ?? (Array.isArray(data) ? firstError(data) : undefined) })
            } else {
                setErrors({ general: err?.message || 'Failed to submit rating. Please try again.' })
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* who you're rating */}
            {person && (
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: 12,
                    }}
                >
                    <Avatar uri={person.photo} size={48} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.dark }}>{person.name}</Text>
                        {person.rating != null && (
                            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                                <Ionicons name="star" size={13} color={STAR_ON} />
                                <Text style={{ marginLeft: 4, fontSize: 12, color: colors.dark }}>{Number(person.rating).toFixed(1)}/5</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* stars */}
            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
                {[1, 2, 3, 4, 5].map((value) => (
                    <TouchableOpacity
                        key={value}
                        onPress={() => setScore(value)}
                        accessibilityRole="button"
                        accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
                        accessibilityState={{ selected: value <= score }}
                        style={{ marginHorizontal: 4 }}
                    >
                        <Ionicons name="star" size={40} color={value <= score ? STAR_ON : STAR_OFF} />
                    </TouchableOpacity>
                ))}
            </View>
            {errors.score ? <Text style={{ color: colors.error, textAlign: "center", marginTop: 6 }}>{errors.score}</Text> : null}

            {/* feedback */}
            <Text style={{ marginTop: 20, marginBottom: 6, fontSize: 13, color: colors.dark }}>Feedback</Text>
            <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Tell us about your experience"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                style={{
                    minHeight: 96,
                    textAlignVertical: "top",
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: errors.feedback ? colors.error : "#9CA3AF",
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: colors.dark,
                }}
            />
            {errors.feedback ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors.feedback}</Text> : null}
            {errors.general ? <Text style={{ color: colors.error, textAlign: "center", marginTop: 10 }}>{errors.general}</Text> : null}

            {/* actions */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
                <TouchableOpacity
                    onPress={() => onDone?.()}
                    disabled={submitting}
                    accessibilityRole="button"
                    style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.dark }}
                >
                    <Text style={{ fontSize: 16, fontWeight: "600", color: colors.dark }}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={submitting}
                    accessibilityRole="button"
                    style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 999, backgroundColor: GREEN, opacity: submitting ? 0.7 : 1 }}
                >
                    {submitting ? (
                        <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.onPrimary }}>Submit</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    )
}
