import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RegionGroup } from "../services/regionService";
import type { PropertyType } from "../types/property.types";
import type { MapFocus } from "../utils/nativeMapHtml";

type SearchDraft = {
  state?: RegionGroup;
  district?: RegionGroup;
  type?: PropertyType;
  query: string;
  customFocus?: MapFocus;
};
export const resumeTabs = ["/home", "/search", "/saved", "/messages", "/profile", "/my-properties"] as const;
type ResumeTab = typeof resumeTabs[number];
let pendingWrite = Promise.resolve();
export const useResumeStore = create<{
  tab: ResumeTab;
  search: SearchDraft;
  setTab: (tab: ResumeTab) => void;
  setSearch: (draft: Partial<SearchDraft>) => void;
}>()(persist((set) => ({
  tab: "/home",
  search: { query: "" },
  setTab: tab => set({ tab }),
  setSearch: draft => set(current => ({ search: { ...current.search, ...draft } })),
}), {
  name: "malikse-resume-v1",
  storage: createJSONStorage(() => ({
    getItem: key => Platform.OS === "web" ? Promise.resolve(null) : AsyncStorage.getItem(key).catch(() => null),
    setItem: (key, value) => {
      if (Platform.OS === "web") return Promise.resolve();
      pendingWrite = pendingWrite.then(() => AsyncStorage.setItem(key, value)).catch(() => {});
      return pendingWrite;
    },
    removeItem: key => AsyncStorage.removeItem(key).catch(() => {}),
  })),
  partialize: state => ({ tab: state.tab, search: state.search }),
  skipHydration: true,
}));

let hydration: Promise<void> | undefined;
export function hydrateResume() {
  return hydration ??= Promise.resolve(useResumeStore.persist.rehydrate()).then(() => {});
}
