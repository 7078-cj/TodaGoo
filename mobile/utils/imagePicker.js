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
