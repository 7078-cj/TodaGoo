import React from "react";
import { View, Text, Image } from "react-native";
import { useProfile } from "../../contexts/ProfileContext";
import colors from "../../constants/colors";
import NotificationBell from "./NotificationBell";
import { useDriverOnline } from "../../utils/driverOnlineStore";
import { useHasActiveBooking } from "../../utils/activeBookingStore";

export default function Header() {
    const { role, profile, details } = useProfile();
    const driverOnline = useDriverOnline();
    const onTrip = useHasActiveBooking();

    // drivers see their availability under the greeting (hidden until it's known)
    const status =
        role !== "driver" ? null
            : onTrip ? "On a trip"
            : driverOnline === true ? "Online"
            : driverOnline === false ? "Offline"
            : null;

    const username = profile?.first_name ?? profile?.username ?? "User";
    const photo = details?.profile_picture;

    return (
        <View
            className="w-full flex-row items-center justify-between px-4 pt-10 pb-3"
            style={{ backgroundColor: colors.primary }}
        >
            <View className="flex-row items-center gap-4">
                {photo ? (
                    <Image
                        source={{ uri: photo }}
                        className="h-14 w-14 rounded-full"
                        resizeMode="cover"
                    />
                ) : (
                    <View
                        className="h-14 w-14 items-center justify-center rounded-full"
                        style={{ backgroundColor: colors.surface }}
                    >
                        <Text
                            className="text-xl font-bold"
                            style={{ color: colors.primary }}
                        >
                            {username.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                <View>
                    <Text
                        className="text-xl font-semibold"
                        style={{ color: colors.onPrimary }}
                    >
                        Hello, {username}!
                    </Text>
                    {status ? (
                        <Text style={{ color: colors.onPrimary, fontSize: 12, marginTop: 2 }}>Status: {status}</Text>
                    ) : null}
                </View>
            </View>

            <NotificationBell />
        </View>
    );
}
