import { Modal, KeyboardAvoidingView, Platform } from "react-native";
import React, { useEffect, useState, useCallback, useRef } from "react";
import Messages from "./Messages";
import ChatInput from "./ChatInput";
import { postMessage, getMessages, seenMessages } from "../../api/chat";


export default function ChatModal({
    visible,
    onClose,
    bookingId,
    currentUserId,
    messages,
    setMessages,
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


    useEffect(() => {
        if (!visible || !bookingId) return;

        (async () => {
            setLoading(true);
            try {
                const res = await getMessages({ booking_id: bookingId });
                await seenMessages({ booking_id: bookingId });
                if (mountedRef.current) setMessages(res);
            } catch (err) {
                console.log("Failed to load messages:", err);
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        })();
    }, [visible, bookingId]);


    useEffect(() => {
        if (!visible || !bookingId || messages?.length === 0) return;

        const hasUnseenIncoming = messages?.some(
            (m) => m.receiver === currentUserId && !m.seen
        );
        if (!hasUnseenIncoming) return;

        seenMessages({ booking_id: bookingId }).catch((err) =>
            console.log("Failed to mark seen:", err)
        );
    }, [visible, bookingId, currentUserId, messages]);


    const handleSend = useCallback(
        async (text) => {
            const trimmed = text.trim();
            if (!trimmed || !bookingId || sending) return;

            setSending(true);
            try {
                await postMessage({
                    message: trimmed,
                    booking_id: bookingId,
                });
            } catch (err) {
                console.log("Failed to send message:", err);
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
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <Messages
                    messages={messages}
                    currentUserId={currentUserId}
                    loading={loading}
                />
                <ChatInput onSend={handleSend} sending={sending} />
            </KeyboardAvoidingView>
        </Modal>
    );
}