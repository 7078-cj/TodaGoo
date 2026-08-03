import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
} from "react-native";
import MapComponent from "./map/MapComponent";

export default function SetLocationMapModal({
    visible,
    setVisible,
    onConfirm,
    onLocationChange,
    onRouteChange,     
    selectedLocation,
    selectedAddress,
    setSelectedLocation,
    setSelectedAddress,
    markers,
    isRoute = true,      
    route: routeProp,    
}) {
    const [location, setLocation] = useState(null);
    const [route, setRoute] = useState([]); 

    useEffect(() => {
        if (visible) {
            if (selectedLocation) {
                setLocation({
                    lat: selectedLocation.lat,
                    lng: selectedLocation.lng,
                    full: selectedAddress,
                });
            } else {
                setLocation(null);
            }
        } else {
            setLocation(null);
            setSelectedLocation(null);
            setSelectedAddress(null);
            setRoute([]);
        }
    }, [visible, selectedLocation, selectedAddress]);

    useEffect(() => {
        if (visible && location?.lat != null && location?.lng != null) {
            onLocationChange?.(
                { lat: location.lat, lng: location.lng },
                location.full
            );
        }
    }, [location, visible]);


    const handleRouteChange = (nextRoute) => {
        setRoute(nextRoute);
        onRouteChange?.(nextRoute);
    };

    const handleConfirm = () => {
        if (!location) return;

        onConfirm(
            {
                lat: location.lat,
                lng: location.lng,
            },
            location.full,
            route
        );

        setVisible(false);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={() => setVisible(false)}
        >
            <Text className="text-lg font-bold text-center p-4">
                Select Location
            </Text>

            {location && (
                <View className="p-4">
                    <Text className="text-gray-700">
                        Selected Location:
                    </Text>

                    <Text className="text-gray-900 font-semibold">
                        {location.full ??
                            `Lat: ${location.lat}, Lng: ${location.lng}`}
                    </Text>
                </View>
            )}

            <View className="items-center">
                <View className="w-[500px] h-[500px]">
                    <MapComponent
                        location={location}
                        setLocation={setLocation}
                        editMode={true}
                        userLocation={true}
                        markers={markers}
                        isRoute={isRoute}
                        route={routeProp}
                        onRouteChange={handleRouteChange}
                    />
                </View>
            </View>

            <View className="flex-row justify-between p-4">
                <TouchableOpacity
                    className="flex-1 bg-blue-500 p-3 rounded-lg mr-2"
                    onPress={handleConfirm}
                >
                    <Text className="text-white text-center font-semibold">
                        Confirm
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-1 bg-gray-300 p-3 rounded-lg ml-2"
                    onPress={() => setVisible(false)}
                >
                    <Text className="text-center font-semibold">
                        Cancel
                    </Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}