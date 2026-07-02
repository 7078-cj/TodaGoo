import { View, Text, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
import MapComponent from "@/components/map/MapComponent";
import SetLocationMapModal from '@/components/SetLocationMapModal';
import { router } from 'expo-router';

export default function home() {

    const handleRoute = () => {
        router.push('/(protected)/passenger/book');
    }

return (
    <View>
        <Text>passenger home</Text>


        <TouchableOpacity
            className="bg-blue-500 p-3 rounded-lg mt-4"
            onPress={handleRoute}
        >
            <Text className="text-white text-center">Book Ride</Text>
        </TouchableOpacity>

        </View>
    )
}