import { View, Text, ScrollView, useWindowDimensions } from 'react-native'
import React, { useState, useRef, useMemo, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import MapComponent from '@/components/map/MapComponent' 
import SetLocationMapModal from '@/components/SetLocationMapModal';
import RouteCard from '@/components/booking/RouteCard'
import FareFooter from '@/components/booking/FareFooter'
import useFareEstimate from '@/hooks/useFareEstimate'
import colors from '@/constants/colors'
import { bookRide } from '../../../api/book' 

// Every booking is a special booking
const BOOKING_TYPE = "special";

export default function Book() {
    const { height } = useWindowDimensions();
    const mapRef = useRef(null);

    const [modalVisible, setModalVisible] = useState(false);
    const [startLocation, setStartLocation] = useState(null);
    const [startAddress, setStartAddress] = useState(null);
    const [endLocation, setEndLocation] = useState(null);
    const [endAddress, setEndAddress] = useState(null);
    const [stops, setStops] = useState([]);
    const [bookingStatus, setBookingStatus] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [selectionType, setSelectionType] = useState(null);
    const [selectedStopIndex, setSelectedStopIndex] = useState(null);

    const [selectedLocation, setSelectedLocation] = useState(null);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [routes, setRoutes] = useState([]);

    const idempotencyKeyRef = useRef(uuidv4());

    const { price, loading: fareLoading, error: fareError } = useFareEstimate(
        startLocation,
        endLocation,
        stops
    );

    /* ----- markers, always in route order: start -> stops -> end ----- */

    const markers = useMemo(() => {
        const list = [];

        if (startLocation) {
            list.push({ id: "start", lat: startLocation.lat, lng: startLocation.lng, full: startAddress });
        }

        stops.forEach((stop, i) => {
            if (stop.location) {
                list.push({
                    id: `stop-${i}`,
                    lat: stop.location.lat,
                    lng: stop.location.lng,
                    full: stop.address,
                });
            }
        });

        if (endLocation) {
            list.push({ id: "end", lat: endLocation.lat, lng: endLocation.lng, full: endAddress });
        }

        return list;
    }, [startLocation, startAddress, stops, endLocation, endAddress]);

    // Keep every marker in view on the main map (skipped while the picker modal is open)
    useEffect(() => {
        if (modalVisible || markers.length === 0) return;
        mapRef.current?.fitToContent();
    }, [markers, modalVisible]);

    /* ----- opening the location modal ----- */

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
        setStops((prev) => [...prev, { location: null, address: "", order: prev.length + 1 }]);
        setSelectionType("stop");
        setSelectedStopIndex(stops.length);
        setSelectedLocation(null);
        setSelectedAddress(null);
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
    };

    /* ----- applying a picked location ----- */

    const applyLocation = (location, address) => {
        switch (selectionType) {
            case "start":
                setStartLocation(location);
                setStartAddress(address);
                break;

            case "end":
                setEndLocation(location);
                setEndAddress(address);
                break;

            case "stop":
                if (selectedStopIndex == null) return;
                setStops((prev) =>
                    prev.map((stop, index) =>
                        index === selectedStopIndex ? { ...stop, location, address } : stop
                    )
                );
                break;
        }
    };

    const handleLocationSelected = (location, address, route) => {
        applyLocation(location, address);
        if (route) setRoutes(route);
        setModalVisible(false);
    };

    /* ----- booking ----- */

    const handleBooking = async () => {
        if (submitting) return;

        if (!startLocation || !endLocation) {
            alert("Please select both start and end locations.");
            return;
        }

        setSubmitting(true);
        setBookingStatus(null);

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
            routes,
            type: BOOKING_TYPE,
        };

        try {
            await bookRide(formData, idempotencyKeyRef.current);
            setBookingStatus("Booking successful!");
        } catch (error) {
            console.error("Booking failed:", error);
            setBookingStatus("Booking failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const bookingOk = bookingStatus?.startsWith("Booking successful");

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            {/* Map: shows start, stop and end markers plus the route */}
            <View style={{ height: height * 0.38 }}>
                <MapComponent
                    ref={mapRef}
                    markers={markers}
                    onRouteChange={setRoutes}
                    userLocation={false}
                />
            </View>

            {/* Booking panel, overlapping the map's bottom edge */}
            <View
                className="flex-1"
                style={{
                    backgroundColor: colors.background,
                    marginTop: -24,
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                    overflow: "hidden",
                }}
            >
                <View className="px-5 pt-5 pb-3">
                    <Text style={{ color: colors.secondary, fontSize: 18, fontWeight: "600" }}>
                        Book a Ride
                    </Text>
                </View>

                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    <RouteCard
                        startAddress={startAddress}
                        endAddress={endAddress}
                        stops={stops}
                        onPressStart={openStartModal}
                        onPressEnd={openEndModal}
                        onPressStop={editStop}
                        onRemoveStop={removeStop}
                        onAddStop={addStop}
                    />

                    {bookingStatus ? (
                        <Text
                            className="text-center mt-4"
                            style={{ color: bookingOk ? colors.success : colors.error }}
                        >
                            {bookingStatus}
                        </Text>
                    ) : null}
                </ScrollView>

                <FareFooter
                    price={price}
                    loading={fareLoading}
                    error={fareError}
                    submitting={submitting}
                    onBook={handleBooking}
                />
            </View>

            <SetLocationMapModal
                selectedLocation={selectedLocation}
                selectedAddress={selectedAddress}
                setSelectedLocation={setSelectedLocation}
                setSelectedAddress={setSelectedAddress}
                visible={modalVisible}
                setVisible={setModalVisible}
                onConfirm={handleLocationSelected}
                onLocationChange={applyLocation}
                onRouteChange={setRoutes}
                markers={markers}
            />
        </View>
    )
}