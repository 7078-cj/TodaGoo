import * as ImagePicker from "expo-image-picker"

export const pickImage = async (setImage) => {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType,
        allowsEditing: true,
        quality: 1,
    })

    if (!result.canceled) {
        setImage(result.assets[0])
    }
}

// Pick one photo from the library; resolves to the asset, or null if cancelled / not allowed
export const pickPhotoFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") return null

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
    })

    return result.canceled ? null : result.assets[0]
}
