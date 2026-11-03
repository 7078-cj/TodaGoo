import { useCallback, useEffect } from "react";
import { useIsFocused } from "expo-router";
import { clearChatRequest, useChatRequested } from "../utils/chatRequestStore";

// Opens the chat modal while a tapped message notification has requested it for this booking.
// The request lives in chatRequestStore until the chat is closed, so if the screen re-renders
// or remounts right after the redirect, the chat simply opens again instead of closing.
// Only the focused screen reacts: a modal from a screen lower in the stack would still show.
// Returns the close handler to give the ChatModal.
export default function useOpenChatParam(bookingId, setChatVisible) {
    const requested = useChatRequested(bookingId);
    const focused = useIsFocused();

    useEffect(() => {
        if (requested && focused) setChatVisible(true);
    }, [requested, focused, setChatVisible]);

    return useCallback(() => {
        setChatVisible(false);
        clearChatRequest();
    }, [setChatVisible]);
}
