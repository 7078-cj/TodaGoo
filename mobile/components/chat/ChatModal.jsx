import { Modal, KeyboardAvoidingView, Platform } from "react-native";
import React, { useEffect, useState, useCallback, useRef } from "react";
import ChatHeader from "./ChatHeader";
import Messages from "./Messages";
import ChatInput from "./ChatInput";
import colors from "../../constants/colors";
import { postMessage, getMessages, seenMessages } from "../../api/chat";

export default function ChatModal({
    visible,
    onClose,
    bookingId,
    currentUserId,
    messages,
    setMessages,
    title = "Message",
    onNotifPress,
    onAttach,
}) {
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Load the conversation when the modal opens
    useEffect(() => {
        if (!visible || !bookingId) return;

        (async () => {
            setLoading(true);
            try {
                const res = await getMessages({ booking_id: bookingId });
                if (mountedRef.current) setMessages(res);
            } catch (err) {
                console.log("Failed to load messages:", err);
            } finally {
                if (mountedRef.current) setLoading(false);
            }

            seenMessages({ booking_id: bookingId }).catch((err) =>
                console.log("Failed to mark seen:", err)
            );
        })();
    }, [visible, bookingId]);

    // Mark new incoming messages as seen while the chat is open
    useEffect(() => {
        if (!visible || !bookingId || !messages?.length) return;

        const hasUnseenIncoming = messages.some(
            (m) => m.receiver === currentUserId && !m.seen
        );
        if (!hasUnseenIncoming) return;

        seenMessages({ booking_id: bookingId }).catch((err) =>
            console.log("Failed to mark seen:", err)
        );
    }, [visible, bookingId, currentUserId, messages]);

    // Returns true/false so the input can restore the text if sending failed
    const handleSend = useCallback(
        async (text) => {
            const trimmed = text.trim();
            if (!trimmed || !bookingId || sending) return false;

            setSending(true);
            try {
                await postMessage({ message: trimmed, booking_id: bookingId });
                return true;
            } catch (err) {
                console.log("Failed to send message:", err);
                return false;
            } finally {
                setSending(false);
            }
        },
        [bookingId, sending]
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: colors.background }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ChatHeader title={title} onBack={onClose} onNotifPress={onNotifPress} />

                <Messages
                    messages={messages}
                    currentUserId={currentUserId}
                    loading={loading}
                />

                <ChatInput onSend={handleSend} onAttach={onAttach} sending={sending} />
            </KeyboardAvoidingView>
        </Modal>
    );
}