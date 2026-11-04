import React from "react";
import { ActivityIndicator } from "react-native";
import { LOADING } from "../../constants/loading";

// The app's spinner with the configured color / size (constants/loading.js)
export default function Spinner({ color = LOADING.spinnerColor, size = LOADING.spinnerSize, style }) {
    return <ActivityIndicator color={color} size={size} style={style} accessibilityLabel="Loading" />;
}
