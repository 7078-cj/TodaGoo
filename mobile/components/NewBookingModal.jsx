import React, { useContext, useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import DriverContext from "../contexts/DriverContext";
import { getLocation } from "../utils/location";

const OFFER_SECONDS = 30;

export default function NewBookingModal() {
    const { pendingBooking, acceptBooking, declineBooking } = useContext(DriverContext);
    const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const intervalRef = useRef(null);


    const visible = !!pendingBooking;

    useEffect(() => {
        if (!visible) {
            clearInterval(intervalRef.current);
            return;
        }

        setSecondsLeft(OFFER_SECONDS);
        intervalRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, [visible, pendingBooking?.id]);

    const handleDecline = async () => {
        const bookingId = pendingBooking?.id;
        if (!bookingId) return; 

        const loc = await getLocation({ setLocation, setErrorMsg });
        if (!loc) {
            console.error(errorMsg || "No location available, cannot decline booking");
            return;
        }

        
        if (!pendingBooking?.id) return;

        declineBooking(bookingId, {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
        });
    };

    const handleAccept = () => {
        const bookingId = pendingBooking?.id;
        if (!bookingId) return;
        acceptBooking(bookingId);
    };

    useEffect(() => {
        if (visible && secondsLeft === 0) {
            handleDecline();
        }
    }, [secondsLeft, visible]);

    if (!visible) return null;

    return (
        <Modal transparent animationType="slide" visible={visible}>
            <View className="flex-1 justify-end bg-black/50">
                <View className="rounded-t-2xl bg-white p-5">
                    <Text className="mb-2 self-center text-lg font-bold text-gray-900">
                        {secondsLeft}s
                    </Text>
                    <Text className="mb-3 text-center text-xl font-semibold text-gray-900">
                        New Booking Request
                    </Text>

                    <View className="mb-5 gap-1">
                        <Text className="text-gray-700">
                            Pickup: {pendingBooking?.start_address ?? "N/A"}
                        </Text>
                        <Text className="text-gray-700">
                            Dropoff: {pendingBooking?.destination_address ?? "N/A"}
                        </Text>
                        <Text className="text-gray-700">
                            Fare: {pendingBooking?.price ?? "N/A"}
                        </Text>
                    </View>

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            className="flex-1 items-center rounded-lg bg-red-500 py-3.5"
                            onPress={handleDecline}
                        >
                            <Text className="font-semibold text-white">Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 items-center rounded-lg bg-green-500 py-3.5"
                            onPress={handleAccept}
                        >
                            <Text className="font-semibold text-white">Accept</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}