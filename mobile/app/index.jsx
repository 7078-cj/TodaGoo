import { Button, Text, View } from "react-native";
import { Href, router } from "expo-router";

export default function Index() {

  const handlePress = (destination) => {
    router.push(destination);
  };

  return (
    <View
      className="bg-amber-50"
    >
      <Button
        title="Login"
        onPress={() => handlePress("/(global)/login")}
      />
      
      
    </View>
  );
}
