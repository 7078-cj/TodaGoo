import { View, Text, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
import MapComponent from "@/components/map/MapComponent";
import SetLocationMapModal from '@/components/SetLocationMapModal';
import {bookRide} from '../../../api/book'

export default function book() {
    const [modalVisible, setModalVisible] = useState(false);
    const [startLocation, setStartLocation] = useState(null);
    const [startAddress, setStartAddress] = useState(null);
    const [endLocation, setEndLocation] = useState(null);
    const [endAddress, setEndAddress] = useState(null);
    const [stops, setStops] = useState([]);
    const [price, setPrice] = useState(null);
    const [bookingStatus, setBookingStatus] = useState(null);

    const [selectionType, setSelectionType] = useState(null);
    const [selectedStopIndex, setSelectedStopIndex] = useState(null);

    const [selectedLocation, setSelectedLocation] = useState(null);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [markers, setMarkers] = useState([]);

    const handleSetStartLocation = (location, address) => {
        setStartLocation(location);
        setStartAddress(address);
    };

    const handleSetEndLocation = (location, address) => {
        setEndLocation(location);
        setEndAddress(address);
    };

    const openStartModal = () => {
        setSelectionType("start");

        setSelectedLocation(startLocation);
        setSelectedAddress(startAddress);

        setModalVisible(true);
    };

    const openEndModal = () => {
        setSelectionType("end");

        setSelectedLocation(endLocation);
        setSelectedAddress(endAddress);

        setModalVisible(true);
    };

    const addStop = () => {
        setStops((prev) => [
            ...prev,
            {
                location: null,
                address: "",
                order: prev.length + 1,
            },
        ]);

        setSelectionType("stop");
        setSelectedStopIndex(stops.length);
        setModalVisible(true);
    };

    const editStop = (index) => {
        setSelectionType("stop");
        setSelectedStopIndex(index);

        setSelectedLocation(stops[index]?.location ?? null);
        setSelectedAddress(stops[index]?.address ?? null);

        setModalVisible(true);
    };

    const removeStop = (index) => {
        setStops((prev) => prev.filter((_, i) => i !== index));
        setMarkers((prev) => prev.filter((m) => m.id !== `stop-${index}`));
    };

    const applyLocation = (location, address) => {
        switch (selectionType) {
            case "start":
                setStartLocation(location);
                setStartAddress(address);
                setMarkers((prev) => [
                    ...prev.filter((marker) => marker.id !== "start"),
                    {
                        id: "start",
                        lat: location.lat,
                        lng: location.lng,
                        full: address,
                    },
                ]);
                break;

            case "end":
                setEndLocation(location);
                setEndAddress(address);
                setMarkers((prev) => [
                    ...prev.filter((marker) => marker.id !== "end"),
                    {
                        id: "end",
                        lat: location.lat,
                        lng: location.lng,
                        full: address,
                    },
                ]);
                break;

            case "stop":
                if (selectedStopIndex == null) return;

                setStops((prev) =>
                    prev.map((stop, index) =>
                        index === selectedStopIndex
                            ? { ...stop, location, address }
                            : stop
                    )
                );
                setMarkers((prev) => [
                    ...prev.filter((marker) => marker.id !== `stop-${selectedStopIndex}`),
                    {
                        id: `stop-${selectedStopIndex}`,
                        lat: location.lat,
                        lng: location.lng,
                        full: address,
                    },
                ]);
                break;
        }
    };

    
    const handleLocationChange = (location, address) => {
        applyLocation(location, address);
    };

    
    const handleLocationSelected = (location, address) => {
        applyLocation(location, address);
        setModalVisible(false);
    };

    const handleBooking = async () => {
        if (!startLocation || !endLocation) {
            alert("Please select both start and end locations.");
            return;
        }

        const formData = {
            start: startLocation,
            start_address: startAddress,
            end: endLocation,
            end_address: endAddress,
            stops: stops.map((stop, index) => ({
                location: stop.location,
                address: stop.address,
                order: index + 1,
            })),
        };
        

        try {
            const response = await bookRide(formData);
            setBookingStatus("Booking successful!");
        }
        catch (error) {
            console.error("Booking failed:", error);
            setBookingStatus("Booking failed. Please try again.");
        }

    }

return (
        <View className="flex-1 p-5 bg-white">

            <TouchableOpacity
                className="bg-blue-500 p-4 rounded-xl"
                onPress={openStartModal}
            >
                <Text className="text-white">
                    {startAddress || "Pickup Location"}
                </Text>
            </TouchableOpacity>

            {stops.map((stop, index) => (
                <View
                    key={index}
                    className="flex-row items-center mt-3"
                >
                    <TouchableOpacity
                        className="flex-1 bg-yellow-500 rounded-xl p-4"
                        onPress={() => editStop(index)}
                    >
                        <Text className="text-white">
                            {stop.address || `Stop ${index + 1}`}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="ml-2 bg-red-500 px-4 py-4 rounded-xl"
                        onPress={() => removeStop(index)}
                    >
                        <Text className="text-white">✕</Text>
                    </TouchableOpacity>
                </View>
            ))}

            <TouchableOpacity
                className="bg-gray-700 p-4 rounded-xl mt-3"
                onPress={addStop}
            >
                <Text className="text-white text-center">
                    + Add Stop
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                className="bg-green-500 p-4 rounded-xl mt-4"
                onPress={openEndModal}
            >
                <Text className="text-white">
                    {endAddress || "Destination"}
                </Text>
            </TouchableOpacity>

            <SetLocationMapModal
                selectedLocation={selectedLocation}
                selectedAddress={selectedAddress}
                setSelectedLocation={setSelectedLocation}
                setSelectedAddress={setSelectedAddress}
                visible={modalVisible}
                setVisible={setModalVisible}
                onConfirm={handleLocationSelected}
                onLocationChange={handleLocationChange}
                markers={markers}
            />

            <TouchableOpacity className="bg-black p-4 rounded-xl mt-5" onPress={handleBooking}>
                <Text className="text-white text-center font-semibold">
                    {bookingStatus || "Book Ride"}
                </Text>

            </TouchableOpacity>

        </View>
    )
}