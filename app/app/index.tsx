import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { resumeTabs, useResumeStore } from "../src/store/resumeStore";

// The root layout owns the startup loader, including when opening a deep link.
export default function Index() {
  const tab = useResumeStore(state => state.tab);
  return <Redirect href={Platform.OS !== "web" && resumeTabs.includes(tab) ? tab : "/home"} />;
}
