import * as Location from "expo-location";
import { ReverseGeolocation } from "./reverseGeolocation";

export async function initLocation({ location, user, setUserLoc, setLocation }) {
    if (location?.lat && location?.lng) {
        setUserLoc(location);
        return;
    }

    if (user?.latitude && user?.longitude) {
        const newLoc = {
        lat: user.latitude,
        lng: user.longitude,
        city: user.location || "",
        country: "",
        full: user.location || "",
        };
        setUserLoc(newLoc);
        setLocation?.(newLoc);
        return;
    }

    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
        console.warn("Location permission denied");
        return;
        }

        
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
        console.warn("Location services are disabled on this device");
        return;
        }

        const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = position.coords;

        const newLoc = await ReverseGeolocation(latitude, longitude);
        setUserLoc(newLoc);
        setLocation?.(newLoc);
    } catch (err) {
        // Don't crash/log-spam — device just doesn't have GPS available (common on emulators)
        console.warn("Could not get current location:", err?.message);
    }
}