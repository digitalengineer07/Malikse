import { renderAppScreen } from "../../components/AppScreen";
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenLayout={renderAppScreen} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
