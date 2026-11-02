import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredToken } from "../utils/tokenStorage";

export default function useWebSocket(url, options = {}) {
    const BASE_URL = process.env.EXPO_PUBLIC_WS_URL || "ws://localhost:8000";

    const socketRef = useRef(null);

    const [connected, setConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const [lastMessage, setLastMessage] = useState(null);

    // Always call the latest callbacks without reconnecting when they change
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const { reconnect = true, reconnectInterval = 3000 } = options;

    useEffect(() => {
        if (!url) return;

        let disposed = false;
        let socket = null;
        let reconnectTimer = null;

        const connect = async () => {
            try {
                const stored = await getStoredToken(); // [SEC-L4] secure storage
                if (disposed || !stored) return;

                const { access } = JSON.parse(stored);

                setConnectionStatus("connecting");

                // [SEC-H8] token goes in the subprotocol list, not the URL,
                // so it never shows up in server/proxy logs (see backend websocket/auth.py)
                socket = new WebSocket(`${BASE_URL}${url}`, ["access_token", access]);
                socketRef.current = socket;

                socket.onopen = async () => {
                    if (disposed) return;
                    setConnected(true);
                    setConnectionStatus("connected");

                    optionsRef.current.onOpen?.();
                    await optionsRef.current.onRefresh?.();
                };

                socket.onmessage = (event) => {
                    let payload = event.data;
                    try {
                        payload = JSON.parse(event.data);
                    } catch {}

                    setLastMessage(payload);
                    optionsRef.current.onMessage?.(payload);
                };

                socket.onerror = (err) => {
                    optionsRef.current.onError?.(err);
                };

                socket.onclose = (event) => {
                    console.log("WS closed:", event.code, event.reason);

                    // Closed on purpose by the cleanup below: don't report or reconnect
                    if (disposed) return;

                    setConnected(false);
                    setConnectionStatus("disconnected");
                    optionsRef.current.onClose?.(event);

                    if (reconnect) {
                        reconnectTimer = setTimeout(connect, reconnectInterval);
                    }
                };
            } catch (err) {
                console.error(err);
            }
        };

        connect();

        return () => {
            disposed = true;
            clearTimeout(reconnectTimer);
            socket?.close();
            setConnected(false);
            setConnectionStatus("disconnected");
        };
    }, [url, reconnect, reconnectInterval]);

    const sendMessage = useCallback((data) => {
        if (socketRef.current?.readyState !== WebSocket.OPEN) return;

        socketRef.current.send(
            typeof data === "string" ? data : JSON.stringify(data)
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