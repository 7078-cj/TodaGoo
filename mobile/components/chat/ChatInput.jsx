import { View, TextInput, TouchableOpacity, Text } from "react-native";
import React, { useState } from "react";

export default function ChatInput({ onSend, sending }) {
    const [text, setText] = useState("");

    const handleSend = () => {
        if (!text.trim() || sending) return;
        onSend(text);
        setText("");
    };

    const disabled = !text.trim() || sending;

    return (
        <View className="flex-row items-end p-2 border-t border-gray-200 bg-white">
            <TextInput
                className="flex-1 max-h-[100px] rounded-full bg-gray-100 px-3.5 py-2 text-[15px] mr-2"
                value={text}
                onChangeText={setText}
                placeholder="Type a message..."
                multiline
                maxLength={1000}
            />
            <TouchableOpacity
                className={`rounded-full px-4 py-2.5 ${disabled ? "bg-blue-200" : "bg-blue-500"}`}
                onPress={handleSend}
                disabled={disabled}
            >
                <Text className="text-white font-semibold">Send</Text>
            </TouchableOpacity>
        </View>
    );
}