import { Redirect } from "expo-router";

// The root layout owns the startup loader, including when opening a deep link.
export default function Index() {
  return <Redirect href="/home" />;
}
