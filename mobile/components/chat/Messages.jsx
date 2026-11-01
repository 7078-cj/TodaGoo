import { View, Text, FlatList, ActivityIndicator } from "react-native";
import React, { useMemo, useRef } from "react";
import MessageBubble from "./MessageBubble";
import colors from "../../constants/colors";

/* ---- Adjust these three getters if your API uses different field names ---- */
const getText = (m) => m.message ?? m.text ?? m.content ?? "";
const getSenderId = (m) => (m.sender && typeof m.sender === "object" ? m.sender.id : m.sender);
const getTime = (m) => {
    const raw = m.created_at ?? m.timestamp ?? m.sent_at ?? m.created;
    const t = raw ? new Date(raw).getTime() : NaN;
    return Number.isNaN(t) ? null : t;
};
/* -------------------------------------------------------------------------- */

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const GAP_MS = 30 * 60 * 1000; // show a time separator after 30 min of silence

function formatTime(d) {
    let h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${min} ${ampm}`;
}

function formatFull(d) {
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${formatTime(d)}`;
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();

function buildItems(messages, currentUserId) {
    const sorted = [...messages].sort((a, b) => (getTime(a) ?? 0) - (getTime(b) ?? 0));

    const items = [];
    let prevTime = null;
    let prevMine = null;

    sorted.forEach((m, i) => {
        const time = getTime(m);
        const senderId = getSenderId(m);
        const isMine = senderId != null ? senderId === currentUserId : m.receiver !== currentUserId;

        if (time != null) {
            if (prevTime == null || time - prevTime > GAP_MS) {
                const d = new Date(time);
                const label =
                    prevTime != null && sameDay(new Date(prevTime), d) ? formatTime(d) : formatFull(d);
                items.push({ type: "separator", id: `sep-${m.id ?? i}`, label });
                prevMine = null; // a separator breaks bubble grouping
            }
            prevTime = time;
        }

        items.push({
            type: "message",
            id: String(m.id ?? `msg-${i}`),
            text: getText(m),
            isMine,
            grouped: prevMine === isMine,
            seen: !!m.seen,
            showSeen: false,
        });
        prevMine = isMine;
    });

    // "Seen" label only under my last message
    for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].type === "message" && items[i].isMine) {
            items[i].showSeen = items[i].seen;
            break;
        }
    }

    return items;
}

export default function Messages({ messages = [], currentUserId, loading }) {
    const listRef = useRef(null);
    const items = useMemo(() => buildItems(messages ?? [], currentUserId), [messages, currentUserId]);

    if (loading && items.length === 0) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    return (
        <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) =>
                item.type === "separator" ? (
                    <Text
                        style={{
                            textAlign: "center",
                            color: "#6B7280",
                            fontSize: 12,
                            marginTop: 18,
                            marginBottom: 4,
                        }}
                    >
                        {item.label}
                    </Text>
                ) : (
                    <MessageBubble
                        text={item.text}
                        isMine={item.isMine}
                        groupedWithPrev={item.grouped}
                        showSeen={item.showSeen}
                    />
                )
            }
            ListEmptyComponent={
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#6B7280" }}>No messages yet. Say hello!</Text>
                </View>
            }
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
        />
    );
}