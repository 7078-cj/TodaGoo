import React, { useContext } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useNavigationContainerRef } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AuthContext from "@/contexts/AuthContext";
import colors from "@/constants/colors";
import { useNoDriversAvailable } from "@/utils/driverAvailabilityStore";
import { useDriverHasActiveBooking } from "@/utils/driverActiveBookingStore";
import { goTo } from "@/utils/navigation";

export default function BottomNav() {
    const navigationRef = useNavigationContainerRef();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const { user } = useContext(AuthContext);

    const role = user?.role?.toLowerCase();
    const noDrivers = useNoDriversAvailable();
    const driverHasActiveBooking = useDriverHasActiveBooking();

    const homeRoute =
        role === "passenger"
            ? "/(protected)/passenger/home"
            : "/(protected)/driver/home";

    // passengers book a ride; drivers go to the ride they're on
    const bookingRoute =
        role === "passenger"
            ? "/(protected)/passenger/book"
            : "/(protected)/driver/en_route";

    // Booking is locked for passengers when no driver is queued, and for drivers with no active ride
    const bookingLocked =
        role === "passenger" ? noDrivers : role === "driver" ? !driverHasActiveBooking : false;

    const tabs = [
        {
            label: "Home",
            route: homeRoute,
            icon: "home-outline",
            activeIcon: "home",
        },
        {
            label: "Booking",
            route: bookingRoute,
            icon: "location-outline",
            activeIcon: "location",
        },
        {
            label: "History",
            route: "/(protected)/history",
            icon: "time-outline",
            activeIcon: "time",
        },
        {
            label: "Profile",
            route: "/(protected)/profile",
            icon: "person-circle-outline",
            activeIcon: "person-circle",
        },
    ];
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
                // pathname has no route groups ("/passenger/book", not "/(protected)/passenger/book")
                const tabPath = tab.route.replace("/(protected)", "");
                const isActive =
                    tab.label === "Home"
                        ? pathname === `/${role}/home`
                        : pathname === tabPath ||
                        pathname.startsWith(`${tabPath}/`);
                const isBookingLocked = tab.label === "Booking" && bookingLocked;

                return (
                    <TouchableOpacity
                        key={tab.label}
                        disabled={isActive || isBookingLocked}
                        activeOpacity={0.7}
                        onPress={() => {
                            // goTo, not push: pushing a driver/passenger route from History or Profile
                            // stacked a second copy of that layout (duplicate sockets and booking offers)
                            if (!isActive) goTo(tab.route, navigationRef.getRootState());
                        }}
                        className="flex-1 items-center justify-center rounded-xl py-2 mx-0.5"
                        style={{
                            backgroundColor: isActive
                                ? "rgba(255, 255, 255, 0.20)"
                                : "transparent",
                            marginHorizontal: 2,
                            borderRadius: 12,
                            opacity: isBookingLocked ? 0.4 : 1,
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
