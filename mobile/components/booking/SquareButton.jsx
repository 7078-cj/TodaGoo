import { TouchableOpacity } from 'react-native'
import React from 'react'
import { Feather } from '@expo/vector-icons'
import colors from '../../constants/colors'

export default function SquareButton({ onPress, color, name }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{ backgroundColor: color, width: 32, height: 32, borderRadius: 6 }}
            className="items-center justify-center"
        >
            <Feather name={name} size={20} color={colors.onPrimary} />
        </TouchableOpacity>
    );
}