import React from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import Spinner from "./Spinner";
import { OVERLAY, LOADING_MESSAGES } from "../../constants/loading";

// Blocking overlay while something runs in the background.
//   <LoadingOverlay visible={searching} message={LOADING_MESSAGES.findingDriver}
//                   actionLabel="Cancel" onAction={cancel} />
// The optional action (e.g. Cancel) is the only thing that can be tapped.
export default function LoadingOverlay({
    visible,
    message = LOADING_MESSAGES.default,
    subMessage,
    actionLabel,
    onAction,
    actionDisabled = false,
}) {
    return (
        <Modal visible={!!visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
            <View style={{ flex: 1, backgroundColor: OVERLAY.backdropColor, alignItems: "center", justifyContent: "center", padding: 32 }}>
                <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={message}
                    style={{ backgroundColor: OVERLAY.cardColor, borderRadius: 16, paddingVertical: 24, paddingHorizontal: 28, alignItems: "center", minWidth: 220 }}
                >
                    <Spinner color={OVERLAY.spinnerColor} />
                    <Text style={{ marginTop: 14, fontSize: 16, fontWeight: "600", color: OVERLAY.textColor, textAlign: "center" }}>{message}</Text>
                    {subMessage ? (
                        <Text style={{ marginTop: 4, fontSize: 12, color: "#6B7280", textAlign: "center" }}>{subMessage}</Text>
                    ) : null}
                    {actionLabel && onAction ? (
                        <TouchableOpacity
                            onPress={onAction}
                            disabled={actionDisabled}
                            accessibilityRole="button"
                            style={{ marginTop: 16, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: OVERLAY.actionColor, opacity: actionDisabled ? 0.5 : 1 }}
                        >
                            <Text style={{ color: OVERLAY.actionColor, fontWeight: "600" }}>{actionLabel}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}
