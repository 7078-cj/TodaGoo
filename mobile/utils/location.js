import * as Location from 'expo-location'


const getLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
            setErrorMsg('Permission to access location was denied')
            return null
        }

        const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        })
        setLocation(loc)
        return loc
    }
