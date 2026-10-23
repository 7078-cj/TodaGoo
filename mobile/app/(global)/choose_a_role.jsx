import { View } from "react-native";
import React from "react";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AuthHeader from "@/components/AuthHeader";   // adjust paths
import ButtonComponent from "@/components/ButtonComponent";
import ChooseRole from "@/assets/Choose_role.svg";
import colors from "@/constants/colors";

export default function choose_a_role() {
    const insets = useSafeAreaInsets();

    // Adjust the route / params to match your register screen
    const handleSelect = (role) => {
        router.push({ pathname: `/register/${role}` });
    };

    return (
        <View className="flex-1 bg-background">
            <AuthHeader tagline="Choose Your Role and Signup" />

            {/* Illustration */}
            <View className="flex-1 items-center justify-center px-8">
                <ChooseRole width="100%" height={300} />
            </View>

            {/* Role buttons */}
            <View className="px-8" style={{ paddingBottom: insets.bottom + 24 }}>
                <ButtonComponent
                    label="Register as Passenger"
                    icon={<Ionicons name="compass-outline" size={22} color={colors.onPrimary} />}
                    onPress={() => handleSelect("passenger")}
                />
                <ButtonComponent
                    label="Register as Driver"
                    variant="outline"
                    className="mt-3"
                    icon={<MaterialCommunityIcons name="motorbike" size={22} color={colors.dark} />}
                    onPress={() => handleSelect("driver")}
                />
            </View>
        </View>
    );
}