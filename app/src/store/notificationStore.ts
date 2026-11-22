import { create } from "zustand";
import api from "../services/authService";
import { useAuthStore } from "./authStore";

export const useNotificationStore = create<{ userId?: string; unread: number; chatRevision: number }>(() => ({ unread: 0, chatRevision: 0 }));

let latestRequest = 0;

export async function refreshNotificationCount() {
  const { user, accessToken } = useAuthStore.getState();
  const request = ++latestRequest;
  if (!user || !accessToken) {
    useNotificationStore.setState({ userId: undefined, unread: 0 });
    return;
  }
  try {
    const { data } = await api.get<{ unread: number }>("/push/notifications/unread");
    if (request === latestRequest && useAuthStore.getState().user?.id === user.id) {
      useNotificationStore.setState({ userId: user.id, unread: data.unread });
    }
  } catch {
    // Preserve the last known count during a network interruption.
  }
}
