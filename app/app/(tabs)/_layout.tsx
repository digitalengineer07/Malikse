import { Tabs } from "expo-router";
import BottomNav from "../../components/BottomNav";

export default function TabLayout() {
  return (
    <Tabs tabBar={() => <BottomNav />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="my-properties" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
