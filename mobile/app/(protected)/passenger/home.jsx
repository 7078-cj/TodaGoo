import { View, Text } from 'react-native'
import React, { useState } from 'react'
import MapComponent from "@/components/map/MapComponent";

export default function home() {
    const [location, setLocation] = useState(null);

return (
    <View>
        <Text>passenger home</Text>

        <View className='w-[500px] h-[500px]'>
            <MapComponent
            location={location}
            setLocation={setLocation}
            editMode={true}
            userLocation={true}
            markers={[
                { id: 1, name: "Shop A", latitude: 14.95, longitude: 120.76 },
            ]}
            />
        </View>


        <View className='p-4'>
            {location ? (
            <>
                <Text className='font-bold text-base'>
                {location.city || "Unknown city"}{location.country ? `, ${location.country}` : ""}
                </Text>
                <Text className='text-sm text-gray-500'>
                {location.full || "Resolving address..."}
                </Text>
                <Text className='text-xs text-gray-400 mt-1'>
                {location.lat?.toFixed(6)}, {location.lng?.toFixed(6)}
                </Text>
            </>
            ) : (
            <Text className='text-sm text-gray-400'>Getting your location...</Text>
            )}
        </View>
        </View>
    )
}