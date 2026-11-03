import { Modal, View, Image, Pressable, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import colors from '../constants/colors'

// Full-size photo on a dark backdrop. Tapping outside the photo (or the X / back button) closes it.
export default function PhotoViewer({ uri, onClose }) {
    const insets = useSafeAreaInsets()

    return (
        <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable
                onPress={onClose}
                accessibilityLabel="Close photo"
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "center", alignItems: "center", padding: 16 }}
            >
                {/* taps on the photo itself don't close it */}
                <Pressable onPress={() => {}} style={{ width: "100%", height: "80%" }}>
                    {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" /> : null}
                </Pressable>

                <TouchableOpacity
                    onPress={onClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close photo"
                    style={{ position: "absolute", top: insets.top + 12, right: 16 }}
                >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="close" size={24} color={colors.onPrimary} />
                    </View>
                </TouchableOpacity>
            </Pressable>
        </Modal>
    )
}

// Wrap any photo with this to open it full size on tap. No photo (uri empty) = not tappable.
export function TappablePhoto({ uri, children, style, accessibilityLabel = "View photo" }) {
    const [open, setOpen] = useState(false)

    if (!uri) return <View style={style}>{children}</View>

    return (
        <>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                activeOpacity={0.85}
                accessibilityRole="imagebutton"
                accessibilityLabel={accessibilityLabel}
                style={style}
            >
                {children}
            </TouchableOpacity>
            {open && <PhotoViewer uri={uri} onClose={() => setOpen(false)} />}
        </>
    )
}
