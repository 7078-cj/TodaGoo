import * as Location from "expo-location";

export const getLocation = async ({ setLocation, setErrorMsg } = {}) => {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
            setErrorMsg?.("Permission to access location was denied");
            return null;
        }

        const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });
        setLocation?.(loc);
        return loc;
    } catch (err) {
        setErrorMsg?.("Failed to get current location");
        return null;
    }
};