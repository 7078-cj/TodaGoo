import { View, Text, FlatList, ActivityIndicator } from "react-native";
import React, { useRef, useEffect } from "react";

export default function Messages({ messages = [], currentUserId, loading }) {
    const listRef = useRef(null);

    useEffect(() => {
        if (messages.length > 0) {
            const t = setTimeout(() => {
                listRef.current?.scrollToEnd({ animated: true });
            }, 50);
            return () => clearTimeout(t);
        }
    }, [messages.length]);

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="small" />
            </View>
        );
    }

    if (messages.length === 0) {
        return (
            <View className="flex-1 items-center justify-center">
                <Text className="text-gray-400">No messages yet. Say hi!</Text>
            </View>
        );
    }

    const renderItem = ({ item }) => {
            const isMine = parseInt(item.sender) === parseInt(currentUserId);

            return (
                <View className={`flex-row my-1 ${isMine ? "justify-end" : "justify-start"}`}>
                    <View
                        className={`max-w-[78%] rounded-2xl px-3 py-2 ${
                            isMine
                                ? "bg-blue-500 rounded-br-md"
                                : "bg-gray-200 rounded-bl-md"
                        } ${item.failed ? "opacity-50" : ""}`}
                    >
                        <Text className={`text-[15px] ${isMine ? "text-white" : "text-gray-900"}`}>
                            {item.message}
                        </Text>
                        <View className="flex-row justify-end mt-0.5 gap-1.5">
                            <Text className="text-[10px] text-black/35">
                                {formatTime(item.created_at)}
                            </Text>
                            {isMine && (
                                <Text className="text-[10px] text-black/35">
                                    {item.failed ? "Failed" : item.pending ? "Sending…" : item.seen ? "Seen" : "Sent"}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
            );
        };

    return (
        <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerClassName="p-3 grow"
            onContentSizeChange={() =>
                listRef.current?.scrollToEnd({ animated: true })
            }
        />
    );
}

function formatTime(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}