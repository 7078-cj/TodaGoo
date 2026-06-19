import { Button, Text, View } from "react-native";
import { Href, router } from "expo-router";

export default function Index() {

  const handlePress = () => {
    router.push(destination);
  };

  return (
    <View
      className="bg-amber-50"
    >
      <Button
        title="Register as Driver"
        onPress={() => handlePress("/(global)/register/driver")}
      />

      <Button
        title="Register as Passenger"
        onPress={() => handlePress("/(global)/register/passenger")}
      />
    </View>
  );
}
