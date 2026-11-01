import { View, Text, TouchableOpacity, Image } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import colors from '../../constants/colors'

export default function BookingHeader({ name = "Mary", photoUri, lang, onLangChange, onNotifPress }) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={{ backgroundColor: colors.primary, paddingTop: insets.top + 8 }}
            className="px-4 pb-3 flex-row items-center"
        >
            <Image
                source={{ uri: photoUri || "https://i.pravatar.cc/100?img=47" }}
                className="w-10 h-10 rounded-full bg-white"
            />
            <Text className="text-white font-semibold ml-3 flex-1">Hello, {name}!</Text>

            <View className="flex-row bg-white rounded-full p-0.5 mr-4">
                {["ENG", "FIL"].map((code) => (
                    <TouchableOpacity
                        key={code}
                        onPress={() => onLangChange?.(code)}
                        className="px-2 py-0.5 rounded-full"
                        style={lang === code ? { backgroundColor: colors.secondary } : null}
                    >
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: "600",
                                color: lang === code ? colors.onPrimary : colors.dark,
                            }}
                        >
                            {code}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity onPress={onNotifPress}>
                <Ionicons name="notifications-outline" size={26} color={colors.onPrimary} />
            </TouchableOpacity>
        </View>
    );
}