import { useEffect } from "react";

// Tells the booking socket whether the chat modal is open, so the backend
// skips message notifications while the user is already reading the chat.
export default function useChatPresence(sendMessage, connected, visible) {
    useEffect(() => {
        if (!connected) return;

        sendMessage({ action: visible ? "chat_open" : "chat_close" });
    }, [sendMessage, connected, visible]);
}
