import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native'
import React, { useState, useEffect, useRef } from 'react'
import MapComponent from './map/MapComponent';

export default function PickTodaStation({ stations, loading, error, onSelect }) {
    const [markers, setMarkers] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const mapRef = useRef(null);

    useEffect(() => {
        if (stations && stations.length > 0) {
            const newMarkers = stations.map(station => ({
                id: station.id,
                name: station.name,
                latitude: station.location.lat,
                longitude: station.location.lng,
            }));
            setMarkers(newMarkers);
        } else {
            setMarkers([]);
        }
    }, [stations]);


    useEffect(() => {
        setSelectedId(null);
    }, [stations]);

    const handleSelectStation = (station) => {
        setSelectedId(station.id);
        onSelect?.(station);

        mapRef.current?.centerOnMarker(station.id, 18);
    };

    const handleMarkerPress = (id) => {
        setSelectedId(id);
        const station = stations.find((s) => s.id === id);
        if (station) onSelect?.(station);
    };

    const label = "text-gray-700 text-sm font-medium mb-1";
    const errorText = "text-red-500 text-sm mt-1";

    return (
        <View className="mb-2">
            <Text className={label}>TODA Station</Text>

            {markers.length > 0 && (
                <View style={{ height: 260, borderRadius: 12, overflow: 'hidden' }}>
                    <MapComponent
                        ref={mapRef}
                        markers={markers}
                        userLocation={false}
                        onMarkerPress={handleMarkerPress}
                    />
                </View>
            )}

            {loading && (
                <View className="flex-row items-center gap-2 py-2">
                    <ActivityIndicator size="small" />
                    <Text className="text-gray-500 text-sm">
                        Loading stations...
                    </Text>
                </View>
            )}

            {error && (
                <Text className={errorText}>{error}</Text>
            )}

            {!loading && !error && stations.length === 0 && (
                <Text className="text-gray-500 text-sm py-2">
                    No stations found for this TODA.
                </Text>
            )}

            {!loading && stations.length > 0 && (
                <View className="flex-row flex-wrap gap-2 mb-1 mt-2">
                    {stations.map((station) => {
                        const isSelected = selectedId === station.id;
                        return (
                            <TouchableOpacity
                                key={station.id}
                                onPress={() => handleSelectStation(station)}
                                className={`px-3 py-2 rounded-lg border ${
                                    isSelected
                                        ? "bg-black border-black"
                                        : "bg-white border-gray-300"
                                }`}
                            >
                                <Text
                                    className={
                                        isSelected
                                            ? "text-white text-sm font-medium"
                                            : "text-gray-700 text-sm"
                                    }
                                >
                                    {station.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    )
}