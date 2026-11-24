import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { Platform } from "react-native";

let registration: { userId: string; token: string } | undefined;
let handlerInstalled = false;

async function notificationsModule() {
  if (Platform.OS !== "android" || isRunningInExpoGo()
    || !Constants.expoConfig?.extra?.androidDeviceAlertsConfigured) return null;
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
    await api.post("/push/devices", { token, platform: Platform.OS }, { headers: authorization, timeout: 5000 });
    if (useAuthStore.getState().user?.id !== userId) {
      await api.delete("/push/devices", { data: { token }, headers: authorization, timeout: 3000 });
      return;
    }
    registration = { userId, token };
  } catch {
    console.warn("[Device alerts] Registration deferred");
  }
}

export async function unregisterPushDevice(userId: string) {
  if (registration?.userId !== userId) return;
  const { token } = registration;
  registration = undefined;
  const { default: api } = await import("./authService");
  await api.delete("/push/devices", { data: { token }, timeout: 3000 });
}

export async function observePushOpens(onOpen: (kind: "inquiry" | "deal" | "property" | "listings", id: string) => void, onReceipt: (kind: unknown) => void) {
  const Notifications = await notificationsModule();
  if (!Notifications) return () => {};
  const open = (response: import("expo-notifications").NotificationResponse) => {
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const { kind, id } = response.notification.request.content.data || {};
    onReceipt(kind);
    if ((kind === "inquiry" || kind === "deal" || kind === "property" || kind === "listings")
      && typeof id === "string" && /^[0-9a-f]{24}$/i.test(id)) onOpen(kind, id);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  const receipts = Notifications.addNotificationReceivedListener(notification => onReceipt(notification.request.content.data?.kind));
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    open(last);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }
  return () => { subscription.remove(); receipts.remove(); };
}
