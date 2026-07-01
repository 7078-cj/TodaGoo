import { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import * as Location from "expo-location";

export default function MapControls({ mapRef, onLocate, style }) {
    const [locating, setLocating] = useState(false);

    const handleLocate = async () => {
        if (locating) return;
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                return; 
            }

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };

            mapRef.current?.recenter(coords, 16);
            onLocate?.(coords); // let the parent add/update a "user" marker if it wants
        } catch (err) {
            console.warn("Failed to get current location", err);
        } finally {
            setLocating(false);
        }
    };

    return (
        <View style={[styles.container, style]} pointerEvents="box-none">
            <View style={styles.group}>
                <TouchableOpacity style={styles.button} onPress={() => mapRef.current?.zoomIn()}>
                    <Text style={styles.icon}>+</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.button} onPress={() => mapRef.current?.zoomOut()}>
                    <Text style={styles.icon}>–</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.button, styles.locateButton]} onPress={handleLocate} disabled={locating}>
                {locating ? (
                    <ActivityIndicator size="small" color="#4285F4" />
                ) : (
                    <Text style={styles.locateIcon}>◎</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const shadow = Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    android: { elevation: 4 },
});

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        right: 16,
        bottom: 24,
        alignItems: "center",
    },
    group: {
        backgroundColor: "#fff",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 12,
        ...shadow,
    },
    button: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    divider: {
        height: 1,
        backgroundColor: "#e5e5e5",
    },
    locateButton: {
        backgroundColor: "#fff",
        borderRadius: 22,
        ...shadow,
    },
    icon: {
        fontSize: 22,
        fontWeight: "600",
        color: "#333",
    },
    locateIcon: {
        fontSize: 20,
        color: "#4285F4",
    },
});