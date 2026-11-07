import { View, Text, TextInput, TouchableOpacity } from "react-native";
import React, { useContext, useRef, useState } from "react";
import { KeyboardScrollContext } from "../layouts/KeyboardAwareScrollView";
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
    multiline = false,
    onFocus,
}) {
    const [hidden, setHidden] = useState(secure);
    // inside a KeyboardAwareScrollView: scroll this field (label, input, error) above the keyboard on focus
    const keyboardScroll = useContext(KeyboardScrollContext);
    const fieldRef = useRef(null);

    return (
        <View className="mb-3" ref={fieldRef}>
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
                    multiline={multiline}
                    onFocus={(e) => {
                        keyboardScroll?.inputFocused(fieldRef.current);
                        onFocus?.(e);
                    }}
                    style={multiline ? { minHeight: 72, textAlignVertical: "top" } : undefined}
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