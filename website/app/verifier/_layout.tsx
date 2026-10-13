import { renderAppScreen } from "../../components/AppScreen";
import { Stack } from "expo-router";

export default function VerifierLayout() {
  return <Stack screenLayout={renderAppScreen} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />;
}
