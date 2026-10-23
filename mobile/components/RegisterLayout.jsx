import { View, Text, Image, ScrollView } from 'react-native'
import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Shared layout for the registration steps. The orange header stays fixed;
// the cream rounded sheet holds the form and scrolls on its own.
// Don't wrap this in another ScrollView.
export default function RegisterLayout({ tagline, children }) {
    const insets = useSafeAreaInsets()

    return (
        <View className="flex-1 bg-primary">
            <View className="px-8 pb-12" style={{ paddingTop: insets.top + 32 }}>
                <Text className="text-onPrimary text-5xl font-bold underline">TodaGoo</Text>
                <Text className="text-onPrimary text-base mt-2" style={{ maxWidth: "40%" }}>
                    {tagline}
                </Text>

                <Image
                    source={require("@/assets/Welcome.png")}
                    style={{ position: "absolute", right: 16, bottom: 40, width: 150, height: 135 }}
                    resizeMode="contain"
                />
            </View>

            <View className="flex-1 bg-background rounded-t-3xl -mt-6 overflow-hidden">
                <ScrollView
                    className="flex-1"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: 32,
                        paddingTop: 32,
                        paddingBottom: insets.bottom + 24,
                    }}
                >
                    {children}
                </ScrollView>
            </View>
        </View>
    )
}