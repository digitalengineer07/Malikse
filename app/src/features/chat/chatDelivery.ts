import { isAxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { useAuthStore } from "../../store/authStore";
import { chatApi } from "./chatApi";
import { ChatOutbox, type Outgoing } from "./chatOutbox";
import { chatRetryDelay, InvalidChatResponse } from "./chatWire";

function storage(key: string) {
  return {
    async read(): Promise<Outgoing[]> {
      const raw = Platform.OS === "web" ? sessionStorage.getItem(key) : await SecureStore.getItemAsync(key);
      return raw ? JSON.parse(raw) : [];
    },
    async save(items: Outgoing[]) {
      if (Platform.OS === "web") {
        if (items.length) sessionStorage.setItem(key, JSON.stringify(items));
        else sessionStorage.removeItem(key);
      } else if (items.length) {
        await SecureStore.setItemAsync(key, JSON.stringify(items));
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    },
  };
}

let session: { actor: string; box: ChatOutbox } | undefined;
let cleanup = Promise.resolve();

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id === previous.user?.id || !session) return;
  const old = session;
  session = undefined;
  cleanup = Promise.all([cleanup, old.box.close()]).then(() => {});
});

export async function discardChatOutbox(actor: string) {
  if (session?.actor === actor) await session.box.close();
  await cleanup;
  await storage("chat.outbox." + actor).save([]);
}

export function outboxFor(actor: string) {
  if (session?.actor === actor) return session.box;
  if (!actor || useAuthStore.getState().user?.id !== actor) throw new Error("Session changed");
  const disk = storage("chat.outbox." + actor);
  const box = new ChatOutbox({
    read: async () => { await cleanup; return disk.read(); },
    save: items => disk.save(items),
    async send(item, signal) {
      if (useAuthStore.getState().user?.id !== actor) throw new Error("Session changed");
      return chatApi.sendMessage(item.thread, item.text, item.key, item.id, signal);
    },
    classify(error, attempts) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (error instanceof InvalidChatResponse || (isAxiosError(error) &&
          (!status || status === 408 || status === 429 || status >= 500))) {
        return { delay: chatRetryDelay(attempts, status, isAxiosError(error) ? error.response?.headers?.["retry-after"] : undefined) };
      }
      const reason = isAxiosError(error) ? error.response?.data?.error || error.response?.data?.message : undefined;
      return { failure: typeof reason === "string" ? reason : "Unable to send this message" };
    },
  });
  session = { actor, box };
  return box;
}

export function resumeChatDelivery(actor: string) {
  const box = outboxFor(actor);
  box.setActive(AppState.currentState == null || AppState.currentState === "active");
  const subscription = AppState.addEventListener("change", state => box.setActive(state === "active"));
  return () => { subscription.remove(); box.setActive(false); };
}
