import { View, Text, ScrollView, useWindowDimensions } from 'react-native'
import React, { useState, useRef, useMemo, useEffect, useContext } from 'react'
import newIdempotencyKey from '../../../utils/idempotencyKey'
import MapComponent from '@/components/map/MapComponent' 
import SetLocationMapModal from '@/components/SetLocationMapModal';
import RouteCard from '@/components/booking/RouteCard'
import FareFooter from '@/components/booking/FareFooter'
import useFareEstimate from '@/hooks/useFareEstimate'
import colors from '@/constants/colors'
import { bookRide, cancelBooking } from '../../../api/book'
import PassengerContext from '../../../contexts/PassengerContext'
import { LoadingOverlay } from '@/components/loading'
import { LOADING_MESSAGES } from '@/constants/loading'

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

    const idempotencyKeyRef = useRef(newIdempotencyKey());

    // After booking: "Finding you a driver..." until a driver accepts (PassengerContext then opens the
    // trip screen) or the server drops the booking (booking_unavailable, shown below). Cancel deletes it.
    const { pendingBooking, bookingUnavailable, setBookingUnavailable } = useContext(PassengerContext);
    const [searchingId, setSearchingId] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const searchFailed = searchingId != null && bookingUnavailable?.booking_id === searchingId;
    const searching = searchingId != null && !pendingBooking && !searchFailed;
    // a driver accepted: the search is over (otherwise the overlay would reappear when the ride ends)
    if (searchingId != null && pendingBooking) {
        setSearchingId(null);
    }
    const [handledFailure, setHandledFailure] = useState(null);
    if (searchFailed && handledFailure !== searchingId) {
        // stop searching and show the server's reason
        setHandledFailure(searchingId);
        setSearchingId(null);
        setBookingStatus(bookingUnavailable.message || "No driver is available right now. Please try again.");
        setBookingUnavailable(null);
    }

    const cancelSearch = async () => {
        if (!searchingId || cancelling) return;
        setCancelling(true);
        try {
            await cancelBooking(searchingId);
            setSearchingId(null);
            setBookingStatus("Booking cancelled.");
        } catch (err) {
            // e.g. a driver accepted it a moment ago: the trip screen opens on its own
            setBookingStatus(err.message);
            setSearchingId(null);
        } finally {
            setCancelling(false);
        }
    };

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
            const booking = await bookRide(formData, idempotencyKeyRef.current);
            setSearchingId(booking?.id ?? null);
        } catch (error) {
            console.error("Booking failed:", error);
            // the server's reason when there is one (e.g. "You already have an ongoing or pending booking.")
            setBookingStatus(error?.message || "Booking failed. Please try again.");
        } finally {
            setSubmitting(false);
            // a new key for the next attempt; reusing it would replay this (cached) response
            idempotencyKeyRef.current = newIdempotencyKey();
        }
    };

    const bookingOk = bookingStatus === "Booking cancelled.";

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

            <LoadingOverlay
                visible={searching}
                message={LOADING_MESSAGES.findingDriver}
                subMessage="We'll take you to your trip as soon as a driver accepts."
                actionLabel={cancelling ? "Cancelling..." : "Cancel"}
                onAction={cancelSearch}
                actionDisabled={cancelling}
            />

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