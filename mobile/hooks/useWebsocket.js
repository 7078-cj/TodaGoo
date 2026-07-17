import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function useWebSocket(url, options = {}) {
    const BASE_URL = process.env.EXPO_PUBLIC_WS_URL || "ws://localhost:8000";
    const fullUrl = url ? `${BASE_URL}${url}` : "";
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState("connecting");
    const [lastMessage, setLastMessage] = useState(null);
    const [access, setAccess] = useState(null);

    const {
        onOpen,
        onClose,
        onError,
        onMessage,
        onRefresh,
        reconnect = false,
        reconnectInterval = 3000,
    } = options;

    
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stored = await AsyncStorage.getItem("token");
                if (stored && mounted) {
                    setAccess(JSON.parse(stored).access);
                }
            } catch (err) {
                console.error("Failed to load token:", err);
            }
        })();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!fullUrl || !access) {
            setConnected(false);
            setConnectionStatus("disconnected");
            return;
        }

        let socket;
        let reconnectTimeout;

        const connect = () => {
            setConnectionStatus("connecting");
            socket = new WebSocket(`${fullUrl}?token=${access}`);
            socketRef.current = socket;

            socket.onopen = () => {
                setConnected(true);
                setConnectionStatus("connected");
                onOpen && onOpen();
                if (onRefresh) {
                    Promise.resolve(onRefresh()).catch((err) => {
                        console.error("WebSocket refresh callback failed:", err);
                    });
                }
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLastMessage(data);
                    onMessage && onMessage(data);
                } catch {
                    setLastMessage(event.data);
                    onMessage && onMessage(event.data);
                }
            };

            socket.onerror = (err) => {
                onError && onError(err);
            };

            socket.onclose = () => {
                setConnected(false);
                setConnectionStatus("disconnected");
                onClose && onClose();
                if (reconnect) {
                    reconnectTimeout = setTimeout(connect, reconnectInterval);
                }
            };
        };

        connect();

        return () => {
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            socket?.close();
        };
    }, [fullUrl, reconnect, reconnectInterval, access]);

    const sendMessage = (data) => {
        if (socketRef.current && connected) {
            socketRef.current.send(
                typeof data === "string" ? data : JSON.stringify(data)
            );
        }
    };

    return { socket: socketRef.current, connected, connectionStatus, lastMessage, sendMessage };
}