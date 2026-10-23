import { View, Text, TouchableOpacity } from 'react-native'
import React, { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import SetLocationMapModal from '@/components/SetLocationMapModal';
import { bookRide, getFarePrice } from '../../../api/book' // adjust if getFarePrice lives elsewhere

const BOOKING_TYPES = [
    { value: "regular", label: "Regular" },
    { value: "special", label: "Special" },
];

export default function book() {
    const [modalVisible, setModalVisible] = useState(false);
    const [startLocation, setStartLocation] = useState(null);
    const [startAddress, setStartAddress] = useState(null);
    const [endLocation, setEndLocation] = useState(null);
    const [endAddress, setEndAddress] = useState(null);
    const [stops, setStops] = useState([]);
    const [price, setPrice] = useState(null);
    const [fareLoading, setFareLoading] = useState(false);
    const [fareError, setFareError] = useState(null);
    const [bookingStatus, setBookingStatus] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [bookingType, setBookingType] = useState("regular");

    const [selectionType, setSelectionType] = useState(null);
    const [selectedStopIndex, setSelectedStopIndex] = useState(null);

    const [selectedLocation, setSelectedLocation] = useState(null);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [routes, setRoutes] = useState([]);

    const idempotencyKeyRef = useRef(uuidv4());

    // Only changes when a stop's coordinates change, not when its address text does
    const stopsKey = stops
        .filter((s) => s.location)
        .map((s) => `${s.location.lat},${s.location.lng}`)
        .join("|");

    // Fetch the fare estimate whenever start / end / stops change
    useEffect(() => {
        if (!startLocation || !endLocation) {
            setPrice(null);
            setFareError(null);
            return;
        }

        let cancelled = false;

        // Debounce: onLocationChange can fire repeatedly while the pin is moved
        const timer = setTimeout(async () => {
            setFareLoading(true);
            setFareError(null);

            try {
                const validStops = stops
                    .filter((s) => s.location)
                    .map((s) => s.location);

                const fare = await getFarePrice(startLocation, endLocation, validStops);
                if (!cancelled) setPrice(fare);
            } catch (error) {
                console.error("Fare estimate failed:", error);
                if (!cancelled) {
                    setPrice(null);
                    setFareError("Couldn't get fare estimate.");
                }
            } finally {
                if (!cancelled) setFareLoading(false);
            }
        }, 500);

        // Cleanup runs on every change, so older in-flight responses are discarded
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        startLocation?.lat,
        startLocation?.lng,
        endLocation?.lat,
        endLocation?.lng,
        stopsKey,
    ]);

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
        const nextStops = stops.filter((_, i) => i !== index);
        setStops(nextStops);

        // Rebuild stop markers so their ids match the new indexes
        setMarkers((prev) => [
            ...prev.filter((m) => !String(m.id).startsWith("stop-")),
            ...nextStops
                .map((stop, i) => ({ stop, i }))
                .filter(({ stop }) => stop.location)
                .map(({ stop, i }) => ({
                    id: `stop-${i}`,
                    lat: stop.location.lat,
                    lng: stop.location.lng,
                    full: stop.address,
                })),
        ]);
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


    const handleLocationSelected = (location, address, route) => {
        applyLocation(location, address);
        if (route) setRoutes(route);
        setModalVisible(false);
    };


    const handleRouteChange = (route) => {
        setRoutes(route);
    };

    const handleBooking = async () => {
        if (submitting) return;

        if (!startLocation || !endLocation) {
            alert("Please select both start and end locations.");
            return;
        }

        setSubmitting(true);

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
            routes: routes,
            type: bookingType,
        };

        try {
            const response = await bookRide(formData, idempotencyKeyRef.current);
            setBookingStatus("Booking successful!");
        }
        catch (error) {
            console.error("Booking failed:", error);
            setBookingStatus("Booking failed. Please try again.");
        }
        finally {
            setSubmitting(false);
        }
    }

    return (
        <View className="flex-1 p-5 bg-white">

            <Text className="text-gray-700 mb-1">Booking Type</Text>
            <View className="flex-row mb-4">
                {BOOKING_TYPES.map(({ value, label }) => (
                    <TouchableOpacity
                        key={value}
                        onPress={() => setBookingType(value)}
                        className={`flex-1 p-3 rounded-xl mr-2 items-center border ${
                            bookingType === value
                                ? "bg-black border-black"
                                : "bg-white border-gray-300"
                        }`}
                    >
                        <Text
                            className={
                                bookingType === value ? "text-white font-semibold" : "text-gray-700"
                            }
                        >
                            {label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

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

            {/* Fare estimate */}
            <View className="mt-4 items-center">
                {fareLoading ? (
                    <Text className="text-gray-500">Calculating fare...</Text>
                ) : fareError ? (
                    <Text className="text-red-500">{fareError}</Text>
                ) : price != null ? (
                    <Text className="text-lg font-semibold">Estimated fare: ₱{price}</Text>
                ) : null}
            </View>

            <SetLocationMapModal
                selectedLocation={selectedLocation}
                selectedAddress={selectedAddress}
                setSelectedLocation={setSelectedLocation}
                setSelectedAddress={setSelectedAddress}
                visible={modalVisible}
                setVisible={setModalVisible}
                onConfirm={handleLocationSelected}
                onLocationChange={handleLocationChange}
                onRouteChange={handleRouteChange}
                markers={markers}
            />

            <TouchableOpacity
                className="bg-black p-4 rounded-xl mt-5"
                onPress={handleBooking}
                disabled={submitting || fareLoading}
            >
                <Text className="text-white text-center font-semibold">
                    {submitting ? "Booking..." : (bookingStatus || "Book Ride")}
                </Text>

            </TouchableOpacity>

        </View>
    )
}