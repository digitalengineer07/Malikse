import { renderAppScreen } from "../../components/AppScreen";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import BottomNav from "../../components/BottomNav";


export default function TabLayout() {
  return (
    <View style={styles.bg}>
      <Tabs screenLayout={renderAppScreen} tabBar={() => <BottomNav />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}>
        <Tabs.Screen name="home" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="my-properties" />
        <Tabs.Screen name="saved" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "transparent" }
});
