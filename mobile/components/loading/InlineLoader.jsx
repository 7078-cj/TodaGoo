import React from "react";
import { View, Text } from "react-native";
import Spinner from "./Spinner";
import { LOADING } from "../../constants/loading";

// Small spinner + text for a section or list that's loading (not the whole screen)
//   <InlineLoader message="Loading stations..." />
export default function InlineLoader({ message, color = LOADING.spinnerColor, style }) {
    return (
        <View
            accessibilityRole="progressbar"
            accessibilityLabel={message || "Loading"}
            style={[{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 }, style]}
        >
            <Spinner size="small" color={color} />
            {message ? <Text style={{ marginLeft: 8, fontSize: 13, color: LOADING.textColor }}>{message}</Text> : null}
        </View>
    );
}
