import React from "react";
import { View, Text, Image, TouchableOpacity, ScrollView } from "react-native";
import colors from "../../constants/colors";
import { ERROR_MESSAGES } from "../../constants/errors";
import { SPLASH } from "../../constants/loading";

// Catches a crash while rendering any screen and shows a recovery screen instead of a blank /
// red screen. "Try again" re-renders the app. In development the error text is shown too.
//   <ErrorBoundary><App /></ErrorBoundary>
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // a crash reporter (e.g. Sentry) would be called here
        console.error("Screen crashed:", error, info?.componentStack);
    }

    reset = () => this.setState({ error: null });

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
                <Image source={SPLASH.logo} style={{ width: 140, height: 125 }} resizeMode="contain" />
                <Text style={{ marginTop: 16, fontSize: 20, fontWeight: "700", color: colors.dark }}>Something went wrong</Text>
                <Text style={{ marginTop: 6, fontSize: 14, color: "#4B5563", textAlign: "center" }}>{ERROR_MESSAGES.crash}</Text>

                {__DEV__ ? (
                    <ScrollView style={{ maxHeight: 160, marginTop: 14, alignSelf: "stretch" }}>
                        <Text style={{ fontSize: 11, color: colors.error, fontFamily: "monospace" }}>{String(error?.stack || error)}</Text>
                    </ScrollView>
                ) : null}

                <TouchableOpacity
                    onPress={this.reset}
                    accessibilityRole="button"
                    style={{ marginTop: 20, backgroundColor: "#0F5A4A", borderRadius: 999, paddingVertical: 14, paddingHorizontal: 40 }}
                >
                    <Text style={{ color: colors.onPrimary, fontWeight: "600", fontSize: 16 }}>Try again</Text>
                </TouchableOpacity>
            </View>
        );
    }
}
