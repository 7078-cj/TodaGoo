import { View, Text, TextInput } from "react-native";
import React, { useState } from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function FormTextField({
    label,
    value,
    onChangeText,
    error,
    placeholder,
    secure = false,
    keyboardType = "default",
    maxLength,
    autoCapitalize = "sentences",
}) {
    const [hidden, setHidden] = useState(secure);

    const labelStyle = "text-gray-700 mb-1";
    const inputStyle = "border border-gray-300 rounded-lg p-3 mb-2";
    const errorStyle = "text-red-500 mb-2";

    return (
        <View>
            <Text className={labelStyle}>{label}</Text>

            <View className="relative justify-center">
                <TextInput
                    className={inputStyle}
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
                        className="absolute right-3"
                    >
                        <Ionicons
                            name={hidden ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#6b7280"
                        />
                    </TouchableOpacity>
                )}
            </View>

            {error && <Text className={errorStyle}>{error}</Text>}
        </View>
    );
}