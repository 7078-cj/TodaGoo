import React from "react";
import { View, Text, Image } from "react-native";
import { useProfile } from "../../contexts/ProfileContext";
import colors from "../../constants/colors";
import NotificationBell from "./NotificationBell";

export default function Header() {
    const { profile, details } = useProfile();

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

                <Text
                    className="text-xl font-semibold"
                    style={{ color: colors.onPrimary }}
                >
                    Hello, {username}!
                </Text>
            </View>

            <NotificationBell />
        </View>
    );
}
