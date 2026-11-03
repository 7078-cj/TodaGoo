import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";

// Opens the chat modal when the screen is reached with ?openChat=1 (set by a tapped
// message notification), then clears the param so the next notification can open it again.
export default function useOpenChatParam(setChatVisible) {
    const { openChat } = useLocalSearchParams();

    useEffect(() => {
        if (openChat !== "1") return;

        setChatVisible(true);
        router.setParams({ openChat: undefined });
    }, [openChat, setChatVisible]);
}
