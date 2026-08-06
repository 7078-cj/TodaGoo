import { View, Text, TouchableOpacity, Image, ScrollView, Modal } from "react-native";
import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

const MAX_IMAGES = 5;

async function openCamera(onPicked) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
        return { error: "Camera permission is required to take a photo." };
    }

    const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
    });

    if (!result.canceled && result.assets?.length) {
        onPicked(result.assets[0]);
    }
    return {};
}

async function openGallery(onPicked) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
        return { error: "Photo library access is required to choose a photo." };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
    });

    if (!result.canceled && result.assets?.length) {
        onPicked(result.assets[0]);
    }
    return {};
}

function ImageSourceModal({ visible, onClose, onPicked }) {
    const [permissionError, setPermissionError] = useState("");

    const handleCamera = async () => {
        const { error } = await openCamera(onPicked);
        if (error) {
            setPermissionError(error);
            return;
        }
        setPermissionError("");
        onClose();
    };

    const handleGallery = async () => {
        const { error } = await openGallery(onPicked);
        if (error) {
            setPermissionError(error);
            return;
        }
        setPermissionError("");
        onClose();
    };

    const handleClose = () => {
        setPermissionError("");
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={handleClose}
                className="flex-1 justify-end bg-black/40"
            >
                <TouchableOpacity activeOpacity={1} className="bg-white rounded-t-2xl p-4">
                    <View className="items-center mb-3">
                        <View className="w-10 h-1 rounded-full bg-gray-300" />
                    </View>

                    <Text className="text-base font-semibold text-gray-800 mb-3 text-center">
                        Add Photo
                    </Text>

                    {permissionError ? (
                        <Text className="text-red-500 text-xs text-center mb-3">
                            {permissionError}
                        </Text>
                    ) : null}

                    <TouchableOpacity
                        onPress={handleCamera}
                        className="flex-row items-center p-3 border-b border-gray-100"
                    >
                        <Ionicons name="camera-outline" size={20} color="#374151" />
                        <Text className="text-gray-700 ml-3">Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleGallery}
                        className="flex-row items-center p-3 border-b border-gray-100"
                    >
                        <Ionicons name="images-outline" size={20} color="#374151" />
                        <Text className="text-gray-700 ml-3">Choose from Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleClose} className="p-3 mt-2 items-center">
                        <Text className="text-red-500 font-medium">Cancel</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

export default function PickImageComponent({
    label,
    image,
    setImage,
    images,
    setImages,
    multiple = false,
    maxImages = MAX_IMAGES,
}) {
    const [sourceModalVisible, setSourceModalVisible] = useState(false);

    const labelStyle = "text-gray-700 mb-1";
    const imageBox = "w-full h-40 rounded-lg mb-2 bg-gray-100 justify-center items-center";
    const thumbBox = "w-24 h-24 rounded-lg mr-2 bg-gray-100 overflow-hidden relative";

    const list = images || [];
    const canAddMore = list.length < maxImages;

    const handlePicked = (picked) => {
        if (multiple) {
            setImages((prev) => [...(prev || []), picked]);
        } else {
            setImage(picked);
        }
    };

    const handleOpenPicker = () => {
        if (multiple && !canAddMore) return;
        setSourceModalVisible(true);
    };

    const handleRemove = (index) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    if (!multiple) {
        return (
            <>
                <Text className={labelStyle}>{label}</Text>
                <TouchableOpacity onPress={handleOpenPicker} className={imageBox}>
                    {image ? (
                        <Image source={{ uri: image.uri }} className="w-full h-full rounded-lg" />
                    ) : (
                        <Text className="text-gray-500">Upload {label}</Text>
                    )}
                </TouchableOpacity>

                <ImageSourceModal
                    visible={sourceModalVisible}
                    onClose={() => setSourceModalVisible(false)}
                    onPicked={handlePicked}
                />
            </>
        );
    }

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
                        onPress={handleOpenPicker}
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

            <ImageSourceModal
                visible={sourceModalVisible}
                onClose={() => setSourceModalVisible(false)}
                onPicked={handlePicked}
            />
        </>
    );
}