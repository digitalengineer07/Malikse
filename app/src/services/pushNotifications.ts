import Constants from "expo-constants";
import { Platform } from "react-native";

let registeredToken: string | null = null;
let handlerInstalled = false;

async function notificationsModule() {
  if (Platform.OS === "web") return null;
  const Notifications = await import("expo-notifications");
  if (!handlerInstalled) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerInstalled = true;
  }
  return Notifications;
}

export async function registerPushDevice(userId: string) {
  try {
    const Notifications = await notificationsModule();
    if (!Notifications) return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("updates", {
        name: "Inquiry and deal updates",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error("Expo project ID is missing");
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { useAuthStore } = await import("../store/authStore");
    const session = useAuthStore.getState();
    if (session.user?.id !== userId || !session.accessToken) return;
    const authorization = { Authorization: `Bearer ${session.accessToken}` };
    const { default: api } = await import("./authService");
    await api.post("/push/devices", { token, platform: Platform.OS }, { headers: authorization });
    if (useAuthStore.getState().user?.id !== userId) {
      await api.delete("/push/devices", { data: { token }, headers: authorization });
      return;
    }
    registeredToken = token;
  } catch (error) {
    console.warn("Could not register push notifications", error);
  }
}

export async function unregisterPushDevice() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  const { default: api } = await import("./authService");
  await api.delete("/push/devices", { data: { token } });
}

export async function observePushOpens(onOpen: (kind: "inquiry" | "deal", id: string) => void) {
  const Notifications = await notificationsModule();
  if (!Notifications) return () => {};
  const open = (response: import("expo-notifications").NotificationResponse) => {
    const { kind, id } = response.notification.request.content.data || {};
    if ((kind === "inquiry" || kind === "deal") && typeof id === "string") onOpen(kind, id);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    open(last);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }
  return () => subscription.remove();
}
