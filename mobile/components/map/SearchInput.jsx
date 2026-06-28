import React from "react";
import { TextInput, TouchableOpacity, View, StyleSheet, Text } from "react-native";

export default function SearchInput({ searchQuery, setSearchQuery, action }) {
    return (
        <View style={styles.container}>
        <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search location..."
            style={styles.input}
            onSubmitEditing={action}
            returnKeyType="search"
        />
        <TouchableOpacity onPress={action} style={styles.button}>
            <Text style={styles.icon}>🔍</Text>
        </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        elevation: 3,
    },
    input: { flex: 1, height: 42, fontSize: 14 },
    button: { padding: 6 },
    icon: { fontSize: 16, width: 20, textAlign: "center" },
});