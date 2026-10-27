import React, { useContext } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AuthContext from "@/contexts/AuthContext";
import colors from "@/constants/colors";

export default function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const { user } = useContext(AuthContext);

    const role = user?.role?.toLowerCase();

    const homeRoute =
        role === "passenger"
            ? "/(protected)/passenger/home"
            : "/(protected)/driver/home";

    const tabs = [
        {
            label: "Home",
            route: homeRoute,
            icon: "home-outline",
            activeIcon: "home",
        },
        {
            label: "Booking",
            route: "/(protected)/passenger/book",
            icon: "location-outline",
            activeIcon: "location",
        },
        {
            label: "History",
            route: "/history",
            icon: "time-outline",
            activeIcon: "time",
        },
        {
            label: "Profile",
            route: "/profile",
            icon: "person-circle-outline",
            activeIcon: "person-circle",
        },
    ];
    console.log({ pathname});

    return (
        <View
            className="w-full flex-row items-center justify-around px-2 pt-1"
            style={{
                backgroundColor: colors.primary,
                paddingBottom: Math.max(insets.bottom, 4),
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.25)",
            }}
        >
            {tabs.map((tab) => {
                const isActive =
                    tab.label === "Home"
                        ? pathname === `/${role}/home`
                        : pathname === tab.route ||
                        pathname.startsWith(`${tab.route}/`);

                return (
                    <TouchableOpacity
                        key={tab.label}
                        disabled={isActive}
                        activeOpacity={0.7}
                        onPress={() => {
                            if (!isActive) router.push(tab.route);
                        }}
                        className="flex-1 items-center justify-center rounded-xl py-2 mx-0.5"
                        style={{
                            backgroundColor: isActive
                                ? "rgba(255, 255, 255, 0.20)"
                                : "transparent",
                            marginHorizontal: 2,
                            borderRadius: 12,
                        }}
                    >
                        <Ionicons
                            name={isActive ? tab.activeIcon : tab.icon}
                            size={24}
                            color={colors.onPrimary}
                        />

                        <Text
                            className="mt-1 text-base"
                            style={{
                                color: colors.onPrimary,
                                fontWeight: isActive ? "600" : "400",
                            }}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
