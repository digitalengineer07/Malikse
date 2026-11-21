import type { AxiosResponse } from "axios";
import api from "./authService";
import { useAuthStore } from "../store/authStore";

const chatBusyMessage = "Messages are temporarily busy. Updates will resume automatically.";

let session: string | undefined;
let retryAt = 0;
let failures = 0;
const pending = new Map<string, Promise<AxiosResponse>>();

export function readChat(path: string): Promise<AxiosResponse> {
  const userId = useAuthStore.getState().user?.id;
  if (session !== userId) {
    session = userId;
    retryAt = 0;
    failures = 0;
    pending.clear();
  }
  const existing = pending.get(path);
  if (existing) return existing;
  if (Date.now() < retryAt) return Promise.reject(new Error(chatBusyMessage));
  const request = api.get(path).catch(error => {
    if (error.response?.status !== 429) throw error;
    if (pending.get(path) === request) {
      const raw = error.response.headers?.["retry-after"];
      const delay = /^\d+$/.test(String(raw)) ? Number(raw) * 1000 : Date.parse(String(raw)) - Date.now();
      failures = Math.min(failures + 1, 3);
      retryAt = Math.max(retryAt, Date.now() + Math.max(1_000, Number.isFinite(delay) ? delay : 15_000 * 2 ** failures));
    }
    throw new Error(chatBusyMessage);
  }).then(response => {
    if (pending.get(path) === request && Date.now() >= retryAt) failures = 0;
    return response;
  }).finally(() => {
    if (pending.get(path) === request) pending.delete(path);
  });
  pending.set(path, request);
  return request;
}
