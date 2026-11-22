import type { AxiosResponse } from "axios";
import api from "./authService";
import { useAuthStore } from "../store/authStore";

export const chatBusyMessage = "Messages are temporarily busy. Updates will resume automatically.";

let session: string | undefined;
const cooldowns = new Map<string, { retryAt: number; failures: number }>();
const pending = new Map<string, Promise<AxiosResponse>>();

export function readChat(path: string): Promise<AxiosResponse> {
  const userId = useAuthStore.getState().user?.id;
  if (session !== userId) {
    session = userId;
    cooldowns.clear();
    pending.clear();
  }
  const existing = pending.get(path);
  if (existing) return existing;
  const resource = path.split("?")[0];
  const cooldown = cooldowns.get(resource);
  if (cooldown && Date.now() < cooldown.retryAt) return Promise.reject(new Error(chatBusyMessage));
  const request = api.get(path).catch(error => {
    if (error.response?.status !== 429) throw error;
    if (pending.get(path) === request) {
      const raw = error.response.headers?.["retry-after"];
      const delay = /^\d+$/.test(String(raw)) ? Number(raw) * 1000 : Date.parse(String(raw)) - Date.now();
      const previous = cooldowns.get(resource);
      const failures = Math.min((previous?.failures ?? 0) + 1, 3);
      cooldowns.set(resource, {
        failures,
        retryAt: Math.max(previous?.retryAt ?? 0, Date.now() + Math.max(1_000, Number.isFinite(delay) ? delay : 15_000 * 2 ** failures)),
      });
    }
    throw new Error(chatBusyMessage);
  }).then(response => {
    if (pending.get(path) === request && (!cooldowns.get(resource) || cooldowns.get(resource) === cooldown)) {
      cooldowns.delete(resource);
    }
    return response;
  }).finally(() => {
    if (pending.get(path) === request) pending.delete(path);
  });
  pending.set(path, request);
  return request;
}
