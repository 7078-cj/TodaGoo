import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import colors from "@/constants/colors";

// Deletes a temp photo that was discarded (retake / cancel / unmount).
// NOTE: on Expo SDK 54+ use `import * as FileSystem from "expo-file-system/legacy"`
// for deleteAsync, otherwise the call throws and is silently ignored below.
async function discardCameraPhoto(uri) {
    if (!uri) return;
    try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
        // best effort only
    }
}

// In-app camera. The system camera (ImagePicker.launchCameraAsync) sends the app to the
// background, where Android can kill it and the photo is lost on relaunch. Capturing
// inside the app keeps it in the foreground the whole time.
export default function CameraCaptureModal({
    visible,
    facing = "back",
    title,
    onCapture,
    onCancel,
}) {
    const insets = useSafeAreaInsets();
    const cameraRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [preview, setPreview] = useState(null);

    // The preview's file until it is handed to onCapture.
    const pendingUriRef = useRef(null);

    const discardPreview = () => {
        discardCameraPhoto(pendingUriRef.current);
        pendingUriRef.current = null;
        setPreview(null);
    };

    useEffect(() => {
        if (!visible) {
            setIsReady(false);
            setIsCapturing(false);
            discardPreview();
        }
    }, [visible]);

    useEffect(() => () => discardCameraPhoto(pendingUriRef.current), []);

    const handleCancel = () => {
        discardPreview();
        onCancel();
    };

    const handleUsePhoto = (photo) => {
        pendingUriRef.current = null; // ownership moves to the caller
        onCapture(photo);
    };

    const handleShutter = async () => {
        if (!cameraRef.current || !isReady || isCapturing) return;

        setIsCapturing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
            if (photo?.uri) {
                pendingUriRef.current = photo.uri;
                setPreview({ uri: photo.uri, width: photo.width, height: photo.height });
            }
        } catch {
            // no photo was taken; the shutter can be pressed again
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleCancel} statusBarTranslucent>
            <View style={styles.container}>
                {preview ? (
                    <Image source={{ uri: preview.uri }} style={styles.camera} resizeMode="contain" />
                ) : (
                    visible && (
                        <CameraView
                            ref={cameraRef}
                            style={styles.camera}
                            facing={facing}
                            mirror={facing === "front"}
                            onCameraReady={() => setIsReady(true)}
                        />
                    )
                )}

                <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
                    <Pressable onPress={handleCancel} hitSlop={12} accessibilityLabel="Close camera">
                        <Ionicons name="close" size={28} color="#fff" />
                    </Pressable>
                    {title ? <Text style={styles.title}>{title}</Text> : null}
                    <View style={styles.topBarSpacer} />
                </View>

                <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
                    {preview ? (
                        <>
                            <Pressable style={styles.secondaryAction} onPress={discardPreview}>
                                <Ionicons name="refresh" size={22} color="#fff" />
                                <Text style={styles.actionLabel}>Retake</Text>
                            </Pressable>
                            <Pressable style={styles.primaryAction} onPress={() => handleUsePhoto(preview)}>
                                <Ionicons name="checkmark" size={22} color="#fff" />
                                <Text style={styles.actionLabel}>Use photo</Text>
                            </Pressable>
                        </>
                    ) : (
                        <Pressable
                            style={[styles.shutter, (!isReady || isCapturing) && styles.shutterDisabled]}
                            onPress={handleShutter}
                            disabled={!isReady || isCapturing}
                            accessibilityLabel="Take photo"
                        >
                            {isCapturing ? <ActivityIndicator color={colors.secondary} /> : null}
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    camera: { flex: 1 },
    topBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
    },
    topBarSpacer: { width: 28 },
    title: { color: "#fff", fontSize: 16, fontWeight: "600" },
    bottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-evenly",
        paddingTop: 24,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
    },
    shutter: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#fff",
        borderWidth: 4,
        borderColor: "rgba(255, 255, 255, 0.5)",
        alignItems: "center",
        justifyContent: "center",
    },
    shutterDisabled: { opacity: 0.5 },
    primaryAction: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        backgroundColor: colors.primary,
    },
    secondaryAction: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    actionLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
});