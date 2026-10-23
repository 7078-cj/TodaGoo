import { Image, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ButtonComponent from "@/components/ButtonComponent"; // adjust path
import AuthHeader from "@/components/AuthHeader";

export default function Index() {
  const insets = useSafeAreaInsets();

  const handlePress = (destination) => {
    router.push(destination);
  };

  return (
    <View className="flex-1 bg-background">
      <AuthHeader tagline="Your Trusted Tricycle Booking App" />

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