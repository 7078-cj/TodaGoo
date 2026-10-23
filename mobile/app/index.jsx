import { Image, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ButtonComponent from "@/components/ButtonComponent"; // adjust path

export default function Index() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const handlePress = (destination) => {
    router.push(destination);
  };

  // Big orange circle pushed up and to the left so only its lower-right
  // curve shows, like the Figma header. Tweak the multipliers to taste.
  const circleSize = width * 1.85;

  return (
    <View className="flex-1 bg-background">
      {/* Orange curved header */}
      <View
        className="absolute bg-primary rounded-full"
        style={{
          width: circleSize,
          height: circleSize,
          left: -width * 0.83,
          top: -width * 0.95,
        }}
      />

      {/* Logo + tagline */}
      <View className="px-8" style={{ paddingTop: insets.top + 56 }}>
        <Text className="text-onPrimary text-[7vh] font-bold underline">TodaGoo</Text>
        <Text className="text-onPrimary text-md mt-3">
          Your Trusted Tricycle Booking App
        </Text>
      </View>

      {/* Illustration */}
      <View className="flex-1 items-center justify-center px-8">
        <Image
          source={require("@/assets/Welcome.png")}
          style={{ width: "100%", height: 288 }}
          resizeMode="contain"
        />
      </View>

      {/* Actions */}
      <View className="px-8" style={{ paddingBottom: insets.bottom + 24 }}>
        <ButtonComponent label="Login" onPress={() => handlePress("/login")} />
        <ButtonComponent
          label="Register"
          variant="outline"
          className="mt-3"
          onPress={() => handlePress("/(global)/choose_a_role")}
        />
      </View>
    </View>
  );
}