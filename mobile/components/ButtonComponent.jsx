import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'

export default function ButtonComponent({onPress,label}) {
    return (
        <TouchableOpacity
        onPress={()=>onPress()}
        className=""
        >
        <Text>{label}</Text>
        </TouchableOpacity>
    )
}