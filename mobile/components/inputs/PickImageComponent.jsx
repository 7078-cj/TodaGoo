import { View, Text, TouchableOpacity, Image, ScrollView } from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { pickImage } from "../../utils/imagePicker";

const MAX_IMAGES = 5;

export default function PickImageComponent({
    label,
    image,
    setImage,
    images,
    setImages,
    multiple = false,
    maxImages = MAX_IMAGES,
}) {
    const labelStyle = "text-gray-700 mb-1";
    const imageBox = "w-full h-40 rounded-lg mb-2 bg-gray-100 justify-center items-center";
    const thumbBox = "w-24 h-24 rounded-lg mr-2 bg-gray-100 overflow-hidden relative";

    if (!multiple) {
        return (
            <>
                <Text className={labelStyle}>{label}</Text>
                <TouchableOpacity onPress={() => pickImage(setImage)} className={imageBox}>
                    {image ? (
                        <Image source={{ uri: image.uri }} className="w-full h-full rounded-lg" />
                    ) : (
                        <Text className="text-gray-500">Upload {label}</Text>
                    )}
                </TouchableOpacity>
            </>
        );
    }

    const list = images || [];
    const canAddMore = list.length < maxImages;

    const handleAdd = () => {
        if (!canAddMore) return;
        pickImage((newImage) => {
            setImages((prev) => [...(prev || []), newImage]);
        });
    };

    const handleRemove = (index) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <>
            <View className="flex-row justify-between items-center mb-1">
                <Text className={labelStyle}>{label}</Text>
                <Text className="text-gray-400 text-xs">
                    {list.length}/{maxImages}
                </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                {list.map((img, index) => (
                    <View key={img.uri || index} className={thumbBox}>
                        <Image source={{ uri: img.uri }} className="w-full h-full" />
                        <TouchableOpacity
                            onPress={() => handleRemove(index)}
                            className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
                        >
                            <Ionicons name="close" size={14} color="#fff" />
                        </TouchableOpacity>
                    </View>
                ))}

                {canAddMore && (
                    <TouchableOpacity
                        onPress={handleAdd}
                        className="w-24 h-24 rounded-lg bg-gray-100 justify-center items-center"
                    >
                        <Ionicons name="add" size={24} color="#6b7280" />
                        <Text className="text-gray-500 text-xs mt-1">Add</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {list.length === 0 && (
                <Text className="text-gray-400 text-xs mb-2">
                    Tap "Add" to attach photo evidence (optional, up to {maxImages}).
                </Text>
            )}
        </>
    );
}