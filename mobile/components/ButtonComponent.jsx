import { Text, TouchableOpacity, ActivityIndicator } from "react-native";
import React from "react";
import colors from "@/constants/colors";

// NativeWind needs full class names in the source, so variants are looked up
// from a map instead of being built with string concatenation.
const VARIANTS = {
    primary: {
        container: "bg-primary border border-primary",
        text: "text-onPrimary",
        spinner: colors.onPrimary,
    },
    secondary: {
        container: "bg-secondary border border-secondary",
        text: "text-onPrimary",
        spinner: colors.onPrimary,
    },
    outline: {
        container: "bg-transparent border border-dark",
        text: "text-dark",
        spinner: colors.dark,
    },
};

export default function ButtonComponent({
    onPress,
    label,
    variant = "primary", // "primary" | "secondary" | "outline"
    disabled = false,
    loading = false,
    className = "",      // extra classes, e.g. "mt-3"
}) {
    const styles = VARIANTS[variant] ?? VARIANTS.primary;
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            className={`w-full py-4 rounded-full items-center justify-center ${styles.container} ${
                isDisabled ? "opacity-50" : ""
            } ${className}`}
        >
            {loading ? (
                <ActivityIndicator color={styles.spinner} />
            ) : (
                <Text className={`font-bold text-base uppercase ${styles.text}`}>
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
}