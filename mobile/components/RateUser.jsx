import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import React, { useState } from 'react'
import { Star } from 'lucide-react-native'
import { createRate } from '../api/rate'
import FormTextField from './FormTextField'
import { router } from "expo-router";

export default function RateUser({ role, bookingId, ratedUserId}) {

    const [score, setScore] = useState(0)
    const [feedback, setFeedback] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState({})

    const validate = () => {
        const newErrors = {}

        if (!score || score < 1 || score > 5) {
            newErrors.score = 'Please select a rating from 1 to 5 stars'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validate()) return

        setSubmitting(true)
        setErrors({})

        try {
            res = await createRate({
                booking_id: bookingId,
                user_id: ratedUserId,
                score,
                feedback: feedback.trim() || null,
            })

            if (res?.success) {
                router.replace(`/(protected)/${role}/home`)
            }
        } catch (err) {
            console.error('Error submitting rating:', err)

            const apiErrors = err?.response?.data
            if (apiErrors && typeof apiErrors === 'object') {
                setErrors(apiErrors)
            } else {
                setErrors({ general: 'Failed to submit rating. Please try again.' })
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <View className="p-5 bg-white flex-1">
            <Text className="text-2xl font-bold mb-2 text-center">
                Rate {ratedRole === 'driver' ? 'your Driver' : 'your Passenger'}
            </Text>

            {ratedUserName && (
                <Text className="text-gray-500 mb-6 text-center">
                    {ratedUserName}
                </Text>
            )}

            <View className="flex-row justify-center mb-2">
                {[1, 2, 3, 4, 5].map((value) => (
                    <TouchableOpacity
                        key={value}
                        onPress={() => setScore(value)}
                        className="mx-1"
                    >
                        <Star
                            size={40}
                            color={value <= score ? '#facc15' : '#d1d5db'}
                            fill={value <= score ? '#facc15' : 'none'}
                        />
                    </TouchableOpacity>
                ))}
            </View>

            {errors.score && (
                <Text className="text-red-500 mb-2 text-center">{errors.score}</Text>
            )}

            <FormTextField
                label="Feedback (optional)"
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Share your experience..."
                error={errors.feedback}
            />

            {errors.general && (
                <Text className="text-red-500 mb-2 text-center">{errors.general}</Text>
            )}

            <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                className={`p-4 rounded-xl mt-3 ${submitting ? 'bg-gray-400' : 'bg-black'}`}
            >
                {submitting ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text className="text-white text-center font-semibold">
                        Submit Rating
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    )
}