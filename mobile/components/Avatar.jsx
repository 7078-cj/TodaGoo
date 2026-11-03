import { View, Image } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'

export default function Avatar({ uri, size = 52 }) {
    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#E5E7EB" }}
            />
        );
    }
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: "#E5E7EB",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Ionicons name="person" size={size * 0.5} color="#9CA3AF" />
        </View>
    );
}
