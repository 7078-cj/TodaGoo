
import { useState } from "react";
import {
    ScrollView,
    RefreshControl,
    } from "react-native";
    import { SafeAreaView } from "react-native-safe-area-context";

    export default function RefreshableScrollView({
    children,
    onRefresh,
    ...props
    }) {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (refreshing) return;

        setRefreshing(true);

        try {
        await onRefresh();
        } catch (error) {
        console.error("Refresh failed:", error);
        } finally {
        setRefreshing(false);
        }
    };

    return (
        <SafeAreaView
        className="flex-1 bg-white"
        edges={["left", "right"]}
        >
        <ScrollView
            {...props}
            refreshControl={
            <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#2563eb"
                colors={["#2563eb"]}
                progressBackgroundColor="#ffffff"
            />
            }
        >
            {children}
        </ScrollView>
        </SafeAreaView>
    );
}
