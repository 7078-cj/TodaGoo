import { Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Shared orange curved header + logo + tagline (Welcome, Choose Role, Login...).
// Render it as the first child of a `flex-1 bg-background` screen.
export default function AuthHeader({ tagline }) {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

  // Big circle pushed up and to the left so only its lower-right curve shows.
  const circleSize = width * 1.85;

return (
        <>
        <View
            className="absolute bg-primary rounded-full"
            style={{
            width: circleSize,
            height: circleSize,
            left: -width * 0.83,
            top: -width * 0.95,
            }}
        />

        <View className="px-8" style={{ paddingTop: insets.top + 56 }}>
            <Text className="text-onPrimary text-[7vh] font-bold underline">TodaGoo</Text>
        
            {tagline ? (
            <Text className="text-onPrimary text-md mt-3">{tagline}</Text>
            ) : null}
        </View>
        </>
    );
}