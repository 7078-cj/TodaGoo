import { View, Text, TextInput } from "react-native";
import React, { useState } from "react";
import { TouchableOpacity } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

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
                        {hidden ? (
                            <EyeOff size={20} color="#6b7280" />
                        ) : (
                            <Eye size={20} color="#6b7280" />
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {error && <Text className={errorStyle}>{error}</Text>}
        </View>
    );
}