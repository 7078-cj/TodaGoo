import React, { useContext, useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DriverContext from "../contexts/DriverContext";
import { getLocation } from "../utils/location";
import { mediaUrl } from "../utils/person";
import colors from "../constants/colors";
import Avatar from "./Avatar";

const OFFER_SECONDS = 30;
const OFFER_GREEN = "#16A34A";  // card border + countdown (red in the last 10 s)
const ACCEPT_GREEN = "#0F5A4A"; // Accept button

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export default function NewBookingModal() {
    const { pendingBooking, acceptBooking, declineBooking } = useContext(DriverContext);
    const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const intervalRef = useRef(null);
    // one decline per offer (button + the 0 s auto-decline could both fire)
    const declinedIdRef = useRef(null);

    const visible = !!pendingBooking;

    const computeRemaining = () => {
        if (pendingBooking?.expires_at) {
            const remaining = Math.round(pendingBooking.expires_at - Date.now() / 1000);
            return Math.max(0, remaining);
        }
        return OFFER_SECONDS;
    };

    useEffect(() => {
        if (!visible) {
            clearInterval(intervalRef.current);
            return;
        }

        setSecondsLeft(computeRemaining());

        intervalRef.current = setInterval(() => {
            const remaining = computeRemaining();
            setSecondsLeft(remaining);
            if (remaining <= 0) {
                clearInterval(intervalRef.current);
            }
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, [visible, pendingBooking?.id]);

    const handleDecline = async () => {
        const bookingId = pendingBooking?.id;
        if (!bookingId || declinedIdRef.current === bookingId) return;
        declinedIdRef.current = bookingId;

        const loc = await getLocation({ setLocation, setErrorMsg });
        if (!loc) {
            console.error(errorMsg || "No location available, cannot decline booking");
            declinedIdRef.current = null; // let the driver try again
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

    const passenger = pendingBooking?.passenger;
    const passengerName =
        [passenger?.first_name, passenger?.last_name].filter(Boolean).map(cap).join(" ") || passenger?.username || "Passenger";
    const rating = passenger?.rating != null ? Number(passenger.rating) : null;
    const urgent = secondsLeft <= 10;

    return (
        <Modal transparent animationType="slide" visible={visible} statusBarTranslucent>
            <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)", padding: 16, paddingBottom: 32 }}>
                <View
                    style={{
                        backgroundColor: colors.surface,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: OFFER_GREEN,
                        padding: 16,
                        paddingTop: 20,
                    }}
                >
                    {/* countdown */}
                    <View
                        style={{
                            position: "absolute",
                            top: -12,
                            right: 12,
                            backgroundColor: urgent ? colors.error : OFFER_GREEN,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 3,
                        }}
                        accessibilityLabel={`${secondsLeft} seconds left`}
                    >
                        <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: 12 }}>{secondsLeft}s</Text>
                    </View>

                    {/* passenger + fare */}
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Avatar uri={mediaUrl(passenger?.profile_picture)} size={48} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: colors.dark }}>
                                {passengerName}
                            </Text>
                            {rating != null && (
                                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                                    <Ionicons name="star" size={13} color="#F59E0B" />
                                    <Text style={{ marginLeft: 4, fontSize: 12, color: colors.dark }}>{rating.toFixed(1)}/5</Text>
                                </View>
                            )}
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.dark }}>₱ {pendingBooking?.price ?? "--"}</Text>
                        {pendingBooking?.type === "special" && (
                            <View style={{ marginLeft: 8, backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text style={{ color: colors.onPrimary, fontSize: 10 }}>Priority</Text>
                            </View>
                        )}
                    </View>

                    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />

                    {/* route */}
                    <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: "row" }}>
                            <Text style={{ width: 72, fontSize: 13, color: colors.dark }}>Pickup:</Text>
                            <Text numberOfLines={2} style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.dark }}>
                                {pendingBooking?.start_address ?? "N/A"}
                            </Text>
                        </View>
                        <View style={{ flexDirection: "row" }}>
                            <Text style={{ width: 72, fontSize: 13, color: colors.dark }}>Drop-off:</Text>
                            <Text numberOfLines={2} style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.dark }}>
                                {pendingBooking?.end_address ?? "N/A"}
                            </Text>
                        </View>
                    </View>

                    {/* actions */}
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                        <TouchableOpacity
                            onPress={handleDecline}
                            accessibilityRole="button"
                            style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.dark }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.dark }}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleAccept}
                            accessibilityRole="button"
                            style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 999, backgroundColor: ACCEPT_GREEN }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.onPrimary }}>Accept</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}