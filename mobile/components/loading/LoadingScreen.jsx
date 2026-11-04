import React from "react";
import { View, Text, Image } from "react-native";
import Spinner from "./Spinner";
import { LOADING, LOADING_MESSAGES } from "../../constants/loading";

// Full-screen (or full-area) loading state: optional logo, spinner, message.
//   <LoadingScreen message={LOADING_MESSAGES.booking} />
//   <LoadingScreen showLogo />                    // logo above the spinner
//   <LoadingScreen fill={false} style={{ marginTop: 32 }} />   // inside a scroll view / tab
export default function LoadingScreen({
    message = LOADING_MESSAGES.default,
    showLogo = false,
    fill = true,
    backgroundColor = LOADING.backgroundColor,
    style,
}) {
    const logo = showLogo ? Image.resolveAssetSource(LOADING.logo) : null;

    return (
        <View
            accessibilityRole="progressbar"
            accessibilityLabel={message || "Loading"}
            style={[
                { alignItems: "center", justifyContent: "center", padding: 24 },
                fill && { flex: 1, backgroundColor },
                style,
            ]}
        >
            {logo ? (
                <Image
                    source={LOADING.logo}
                    style={{ width: LOADING.logoWidth, height: (LOADING.logoWidth * logo.height) / logo.width, marginBottom: 20 }}
                    resizeMode="contain"
                />
            ) : null}
            <Spinner />
            {message ? (
                <Text style={{ marginTop: 12, fontSize: 14, color: LOADING.textColor, textAlign: "center" }}>{message}</Text>
            ) : null}
        </View>
    );
}
