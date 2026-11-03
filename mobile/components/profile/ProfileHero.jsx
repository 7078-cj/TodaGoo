import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import Avatar from '../Avatar'
import { TappablePhoto } from '../PhotoViewer'
import colors from '../../constants/colors'

export const HERO_GREEN = "#0F5A4A"; // dark green from the design

function StarRating({ rating }) {
    const rounded = Math.round(Number(rating) || 0)
    return (
        <View style={{ flexDirection: "row", marginTop: 4 }} accessibilityLabel={`Rating ${Number(rating || 0).toFixed(1)} out of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons key={n} name={n <= rounded ? "star" : "star-outline"} size={18} color={colors.onPrimary} style={{ marginHorizontal: 2 }} />
            ))}
        </View>
    )
}

// Green block: avatar, name, stars, edit button, and the tab bar underneath
export default function ProfileHero({ name, photo, rating, tabs, activeTab, onTabChange, onEdit }) {
    return (
        <View style={{ backgroundColor: HERO_GREEN, paddingTop: 16 }}>
            <TouchableOpacity
                onPress={onEdit}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                style={{ position: "absolute", top: 14, right: 16 }}
            >
                <Ionicons name="create-outline" size={24} color={colors.onPrimary} />
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
                <TappablePhoto uri={photo} accessibilityLabel="View profile photo">
                    <View style={{ borderWidth: 3, borderColor: colors.onPrimary, borderRadius: 60 }}>
                        <Avatar uri={photo} size={96} />
                    </View>
                </TappablePhoto>
                <Text style={{ marginTop: 8, fontSize: 22, fontWeight: "700", color: colors.onPrimary }}>{name}</Text>
                <StarRating rating={rating} />
            </View>

            <View style={{ flexDirection: "row", paddingHorizontal: 16, marginTop: 14 }}>
                {tabs.map((tab) => {
                    const active = tab.key === activeTab
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => onTabChange(tab.key)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            style={{ marginRight: 18, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: active ? colors.onPrimary : "transparent" }}
                        >
                            <Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: active ? "600" : "400" }}>{tab.label}</Text>
                        </TouchableOpacity>
                    )
                })}
            </View>
        </View>
    )
}
