import { View, Text, TouchableOpacity, Image } from 'react-native'
import React from 'react'
import {pickImage} from '../utils/imagePicker'

export default function PickImageComponent({label, setImage, image}) {
    const labelStyle = "text-gray-700 mb-1"
    const imageBox = "w-full h-40 rounded-lg mb-2 bg-gray-100 justify-center items-center"

    return (
        <>
            <Text className={labelStyle}>{label}</Text>
            <TouchableOpacity
                onPress={() => pickImage(setImage)}
                className={imageBox}
            >
                {image ? (
                    <Image source={{ uri: image.uri }} className="w-full h-full rounded-lg" />
                ) : (
                    <Text className="text-gray-500">Upload {label}</Text>
                )}
            </TouchableOpacity>
        </>
    )
}