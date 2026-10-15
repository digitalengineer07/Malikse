import { renderAppScreen } from "../../components/AppScreen";
import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack screenLayout={renderAppScreen} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="staff" />
    </Stack>
  );
}
