import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import useNotificationListener from "../listeners/notificationListener";
import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../api/notifications";

const NotificationContext = createContext(null);

export default NotificationContext;

export function NotificationProvider({ children }) {
    const [userId, setUserId] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    // Latest notification pushed over the socket, shown by NotificationToast
    const [incoming, setIncoming] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const stored = await AsyncStorage.getItem("user");
                if (stored) setUserId(JSON.parse(stored).user_id);
            } catch (err) {
                console.error("Failed to load user:", err);
            }
        })();
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setNotifications(await getNotifications());
        } catch (err) {
            console.log("Failed to load notifications:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleNotification = useCallback((action, notification) => {
        setNotifications((prev) => {
            const rest = prev.filter((n) => n.id !== notification.id);
            return action === "created"
                ? [notification, ...rest]
                : prev.map((n) => (n.id === notification.id ? notification : n));
        });

        if (action === "created") setIncoming(notification);
    }, []);

    // Reloads the list every time the socket (re)connects, so nothing is missed while offline
    const { connected } = useNotificationListener(userId, refresh, handleNotification);

    const markRead = useCallback(async (id) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        try {
            await markNotificationRead(id);
        } catch (err) {
            console.log(err);
        }
    }, []);

    // The backend uses queryset.update() here, which sends no socket event, so update locally
    const markAllRead = useCallback(async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        try {
            await markAllNotificationsRead();
        } catch (err) {
            console.log(err);
        }
    }, []);

    const clearIncoming = useCallback(() => setIncoming(null), []);

    const value = useMemo(
        () => ({
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
            loading,
            connected,
            refresh,
            markRead,
            markAllRead,
            incoming,
            clearIncoming,
        }),
        [notifications, loading, connected, refresh, markRead, markAllRead, incoming, clearIncoming]
    );

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);

    if (!context) {
        throw new Error("useNotifications must be used inside NotificationProvider");
    }

    return context;
}
