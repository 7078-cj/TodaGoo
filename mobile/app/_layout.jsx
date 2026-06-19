import { Stack } from "expo-router";
import "../global.css";
import AuthProvider from "../contexts/AuthContext"

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack />
    </AuthProvider>
    )
}
