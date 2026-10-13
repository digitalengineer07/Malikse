/**
 * MalikSe — Language Store (English + Hindi)
 */
import { create } from "zustand";

type Language = "en" | "hi";

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  language: "en",
  setLanguage: (language) => set({ language }),
  toggleLanguage: () => set({ language: get().language === "en" ? "hi" : "en" }),
}));
