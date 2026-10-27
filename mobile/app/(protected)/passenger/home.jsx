import { View, Text, TouchableOpacity, Image } from 'react-native'
import React from 'react'
import MapComponent from '@/components/map/MapComponent'
import { router } from 'expo-router'
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
    const handleRoute = () => {
        router.push('/(protected)/passenger/book')
    }

    return (
        <SafeAreaView className="flex-1 bg-[#FBF8EC]"  edges={[, "left", "right"]}>
            {/* Map: only marks the passenger, no location fetching */}
            <View style={{ flex: 1.1 }}>
                <MapComponent
                    location={null}
                    userLocation={true}
                    editMode={false}
                    isRoute={false}
                    canHover={false}
                />
            </View>

            {/* Bottom card */}
            <View className="flex  bg-[#FBF8EC] px-6 pt-6 pb-8 justify-center">
                <View className="flex-row items-center justify-between mb-5">
                    <Text className="flex-1 text-2xl text-gray-800 pr-3">
                        Where would you like to go{' '}
                        <Text className="font-bold">today</Text>?
                    </Text>

                    <Image
                        source={require('@/assets/passenger_home.png')}
                        style={{ width: 150, height: 150 }}
                        resizeMode="contain"
                    />
                </View>

                <TouchableOpacity
                    onPress={handleRoute}
                    activeOpacity={0.85}
                    className="bg-[#0F5A4A] py-4 rounded-full"
                >
                    <Text className="text-white text-center text-lg font-medium">
                        Book a Ride
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}