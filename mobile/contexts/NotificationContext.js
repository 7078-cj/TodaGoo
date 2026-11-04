import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useNotificationListener from "../listeners/notificationListener";
import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    deleteNotifications,
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
        if (action === "deleted") {
            const gone = new Set(notification ?? []); // ids
            setNotifications((prev) => prev.filter((n) => !gone.has(n.id)));
            return;
        }
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

    // latest list, so deleteMany knows what it removed (to put it back if the server refuses)
    const notificationsRef = useRef(notifications);
    useEffect(() => {
        notificationsRef.current = notifications;
    }, [notifications]);

    // Removes them right away; if the server refuses, puts them back and throws (the screen shows it)
    const deleteMany = useCallback(async (ids) => {
        const gone = new Set(ids);
        const removed = notificationsRef.current.filter((n) => gone.has(n.id));
        setNotifications((prev) => prev.filter((n) => !gone.has(n.id)));
        try {
            if (ids.length === 1) await deleteNotification(ids[0]);
            else await deleteNotifications(ids);
        } catch (err) {
            setNotifications((prev) => {
                const present = new Set(prev.map((n) => n.id));
                return [...prev, ...removed.filter((n) => !present.has(n.id))].sort(
                    (a, b) => new Date(b.created_at) - new Date(a.created_at)
                );
            });
            throw err;
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
            deleteMany,
            incoming,
            clearIncoming,
        }),
        [notifications, loading, connected, refresh, markRead, markAllRead, deleteMany, incoming, clearIncoming]
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
