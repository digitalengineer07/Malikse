import { create } from "zustand";
import api from "../services/authService";
import { useAuthStore } from "./authStore";

export const useNotificationStore = create<{ userId?: string; unread: number; chatRevision: number }>(() => ({ unread: 0, chatRevision: 0 }));

let latestRequest = 0;
let nextCountCheck = 0;
let countTimer: ReturnType<typeof setTimeout> | undefined;

// The incoming push and its subsequent chat read both invalidate the same bell count.
export function scheduleNotificationCount() {
  if (countTimer) return;
  const actor = useAuthStore.getState().user?.id;
  if (!actor) return;
  countTimer = setTimeout(() => {
    countTimer = undefined;
    if (useAuthStore.getState().user?.id === actor) {
      nextCountCheck = Date.now() + 15000;
      void refreshNotificationCount();
    }
  }, Math.max(1200, nextCountCheck - Date.now()));
}

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
