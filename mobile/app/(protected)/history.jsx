import React, { useCallback, useContext, useMemo, useState } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import AuthContext from "../../contexts/AuthContext";
import { getBookingHistory } from "../../api/book";
import colors from "../../constants/colors";
import PageHeader from "../../components/layouts/PageHeader";
import HistoryFilterTabs, { HISTORY_FILTERS } from "../../components/history/HistoryFilterTabs";
import HistoryCard from "../../components/history/HistoryCard";
import BookingHistoryModal from "../../components/history/BookingHistoryModal";

export default function History() {
    const { user } = useContext(AuthContext);
    const isDriver = user?.role?.toLowerCase() === "driver";

    const [bookings, setBookings] = useState([]);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);

    const load = useCallback(async () => {
        try {
            setBookings(await getBookingHistory());
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Reload each time the tab is opened, so a ride that just finished shows up
    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const visible = useMemo(() => {
        const status = HISTORY_FILTERS.find((f) => f.key === filter)?.status;
        return status ? bookings.filter((b) => b.status === status) : bookings;
    }, [bookings, filter]);

    const emptyText = {
        all: "No rides yet.",
        completed: "No completed rides yet.",
        cancelled: "No cancelled rides.",
    }[filter];

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            <PageHeader title="Ride History" />

            <View style={{ flex: 1, paddingHorizontal: 16 }}>
                <HistoryFilterTabs value={filter} onChange={setFilter} />

                {loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
                ) : (
                    <FlatList
                        data={visible}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item }) => <HistoryCard booking={item} onPress={setSelected} />}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    load();
                                }}
                            />
                        }
                        contentContainerStyle={visible.length === 0 ? { flexGrow: 1 } : { paddingBottom: 16 }}
                        ListEmptyComponent={
                            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                                <Ionicons
                                    name={error ? "cloud-offline-outline" : "time-outline"}
                                    size={44}
                                    color="#9CA3AF"
                                />
                                <Text style={{ marginTop: 10, color: "#6B7280", textAlign: "center" }}>
                                    {error ?? emptyText}
                                </Text>
                                {error && (
                                    <TouchableOpacity onPress={load} style={{ marginTop: 10 }}>
                                        <Text style={{ color: colors.primary, fontWeight: "600" }}>Try again</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        }
                    />
                )}
            </View>

            <BookingHistoryModal
                booking={selected}
                visible={!!selected}
                onClose={() => setSelected(null)}
                currentUserId={user?.user_id}
                isDriver={isDriver}
            />
        </View>
    );
}
