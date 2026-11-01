import { View, Text } from "react-native";
import React from "react";
import colors from "../../constants/colors";

const SENT_BG = "#C9EBE2"; // light mint from the design

export default function MessageBubble({ text, isMine, groupedWithPrev, showSeen }) {
    return (
        <View
            style={{
                alignItems: isMine ? "flex-end" : "flex-start",
                marginTop: groupedWithPrev ? 4 : 14,
            }}
        >
            <View
                style={[
                    {
                        maxWidth: "78%",
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 18,
                    },
                    isMine
                        ? { backgroundColor: SENT_BG, borderBottomRightRadius: 6 }
                        : {
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.secondary,
                              borderBottomLeftRadius: 6,
                          },
                ]}
            >
                <Text style={{ color: isMine ? colors.dark : colors.secondary, fontSize: 15 }}>
                    {text}
                </Text>
            </View>

            {showSeen ? (
                <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>Seen</Text>
            ) : null}
        </View>
    );
}