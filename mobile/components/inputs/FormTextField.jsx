import { View, Text, TextInput, TouchableOpacity } from "react-native";
import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

export default function FormTextField({
    label,
    value,
    onChangeText,
    error,
    placeholder,
    secure = false, // password field: hides text and shows the eye toggle
    keyboardType = "default",
    maxLength,
    autoCapitalize = "sentences",
}) {
    const [hidden, setHidden] = useState(secure);

    return (
        <View className="mb-3">
            <Text className="text-text text-xs font-medium mb-1">{label}</Text>

            {/* No margin inside this box, so the eye icon stays vertically centered */}
            <View className="relative justify-center">
                <TextInput
                    className={`bg-surface border rounded-xl px-4 py-3 text-dark ${
                        error ? "border-error" : "border-border"
                    } ${secure ? "pr-12" : ""}`}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    keyboardType={keyboardType}
                    maxLength={maxLength}
                    autoCapitalize={autoCapitalize}
                    secureTextEntry={secure && hidden}
                />

                {secure && (
                    <TouchableOpacity
                        onPress={() => setHidden((prev) => !prev)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={hidden ? "Show password" : "Hide password"}
                        className="absolute right-4"
                    >
                        <Ionicons
                            name={hidden ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#6b7280"
                        />
                    </TouchableOpacity>
                )}
            </View>

            {error ? <Text className="text-error text-xs mt-1">{error}</Text> : null}
        </View>
    );
}