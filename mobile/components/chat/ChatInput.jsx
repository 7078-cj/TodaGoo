import { View, TextInput, TouchableOpacity } from "react-native";
import React, { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "../../constants/colors";

const FIELD_BG = "#EDEDED";

export default function ChatInput({ onSend, onAttach, sending }) {
    const insets = useSafeAreaInsets();
    const [text, setText] = useState("");

    const canSend = text.trim().length > 0 && !sending;

    const submit = async () => {
        if (!canSend) return;

        const value = text;
        setText(""); // clear right away so it feels instant
        const ok = await onSend?.(value);
        if (ok === false) setText(value); // put the text back if sending failed
    };

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "flex-end",
                paddingHorizontal: 12,
                paddingTop: 8,
                paddingBottom: Math.max(insets.bottom, 8),
                backgroundColor: colors.background,
                borderTopWidth: 1,
                borderTopColor: colors.border,
            }}
        >
            <TouchableOpacity
                onPress={onAttach}
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: FIELD_BG,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Feather name="paperclip" size={20} color={colors.dark} />
            </TouchableOpacity>

            <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Enter your message"
                placeholderTextColor="#9CA3AF"
                multiline
                style={{
                    flex: 1,
                    marginHorizontal: 8,
                    minHeight: 44,
                    maxHeight: 120,
                    borderRadius: 10,
                    backgroundColor: FIELD_BG,
                    paddingHorizontal: 14,
                    paddingTop: 12,
                    paddingBottom: 12,
                    color: colors.dark,
                    fontSize: 15,
                }}
            />

            <TouchableOpacity
                onPress={submit}
                disabled={!canSend}
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: canSend ? colors.secondary : FIELD_BG,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Feather name="send" size={20} color={canSend ? colors.onPrimary : "#9CA3AF"} />
            </TouchableOpacity>
        </View>
    );
}