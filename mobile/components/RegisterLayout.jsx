import { View, Text, Image } from 'react-native'
import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import KeyboardAwareScrollView, { useKeyboardVisible } from './layouts/KeyboardAwareScrollView'

// Shared layout for the registration steps (and Forgot Password). The orange header stays fixed;
// the cream rounded sheet holds the form and scrolls on its own, bringing the focused field above
// the keyboard. While the keyboard is open the header shrinks (no picture) to leave the form room.
// Wrap it in a KeyboardAvoidingView / KeyboardAvoider; don't wrap it in another ScrollView.
export default function RegisterLayout({ tagline, children }) {
    const insets = useSafeAreaInsets()
    const keyboardOpen = useKeyboardVisible()

    return (
        <View className="flex-1 bg-primary">
            <View
                className="px-8"
                style={{ paddingTop: insets.top + (keyboardOpen ? 12 : 32), paddingBottom: keyboardOpen ? 30 : 48 }}
                testID="register-header"
            >
                <Text className={`text-onPrimary font-bold underline ${keyboardOpen ? "text-2xl" : "text-5xl"}`}>TodaGoo</Text>
                {keyboardOpen ? null : (
                    <>
                        <Text className="text-onPrimary text-base mt-2" style={{ maxWidth: "40%" }}>
                            {tagline}
                        </Text>
                        <Image
                            source={require("@/assets/Welcome.png")}
                            style={{ position: "absolute", right: 16, bottom: 40, width: 150, height: 135 }}
                            resizeMode="contain"
                        />
                    </>
                )}
            </View>

            <View className="flex-1 bg-background rounded-t-3xl -mt-6 overflow-hidden">
                <KeyboardAwareScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: 32,
                        paddingTop: keyboardOpen ? 20 : 32,
                        paddingBottom: insets.bottom + 24,
                    }}
                >
                    {children}
                </KeyboardAwareScrollView>
            </View>
        </View>
    )
}
