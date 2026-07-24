import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function useWebSocket(url, options = {}) {
    const BASE_URL =
        process.env.EXPO_PUBLIC_WS_URL || "ws://localhost:8000";

    const socketRef = useRef(null);

    const [connected, setConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] =
        useState("disconnected");
    const [lastMessage, setLastMessage] = useState(null);

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
        if (!url) return;

        let socket;
        let reconnectTimer;

        const connect = async () => {
            try {
                const stored = await AsyncStorage.getItem("token");

                if (!stored) return;

                const { access } = JSON.parse(stored);

                setConnectionStatus("connecting");

                socket = new WebSocket(
                    `${BASE_URL}${url}?token=${access}`
                );

                socketRef.current = socket;

                socket.onopen = async () => {
                    setConnected(true);
                    setConnectionStatus("connected");

                    onOpen?.();
                    await onRefresh?.();
                };

                socket.onmessage = (event) => {
                    let payload = event.data;

                    try {
                        payload = JSON.parse(event.data);
                    } catch {}

                    setLastMessage(payload);
                    onMessage?.(payload);
                };

                socket.onerror = (err) => {
                    onError?.(err);
                };

                socket.onclose = () => {
                    setConnected(false);
                    setConnectionStatus("disconnected");

                    onClose?.();

                    if (reconnect) {
                        reconnectTimer = setTimeout(
                            connect,
                            reconnectInterval
                        );
                    }
                };
            } catch (err) {
                console.error(err);
            }
        };

        connect();

        return () => {
            clearTimeout(reconnectTimer);
            socket?.close();
        };
    }, [url, reconnect, reconnectInterval]);

    const sendMessage = useCallback((data) => {
        if (socketRef.current?.readyState !== WebSocket.OPEN) return;

        socketRef.current.send(
            typeof data === "string"
                ? data
                : JSON.stringify(data)
        );
    }, []);

    return {
        socket: socketRef.current,
        connected,
        connectionStatus,
        lastMessage,
        sendMessage,
    };
}