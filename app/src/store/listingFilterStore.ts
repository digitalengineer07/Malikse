/**
 * MalikSe — Listing Filter Store (buyer-side search state)
 */
import { create } from "zustand";
import type { PropertyType } from "../types/property.types";

interface ListingFilterStore {
  location: string;
  budgetMin: number | null;
  budgetMax: number | null;
  propertyType: PropertyType | null;
  verifiedOnly: boolean;
  page: number;

  setLocation: (location: string) => void;
  setBudgetMin: (min: number | null) => void;
  setBudgetMax: (max: number | null) => void;
  setPropertyType: (type: PropertyType | null) => void;
  setVerifiedOnly: (value: boolean) => void;
  nextPage: () => void;
  resetFilters: () => void;
}

export const useListingFilterStore = create<ListingFilterStore>((set) => ({
  location: "",
  budgetMin: null,
  budgetMax: null,
  propertyType: null,
  verifiedOnly: false,
  page: 1,

  setLocation: (location) => set({ location, page: 1 }),
  setBudgetMin: (budgetMin) => set({ budgetMin, page: 1 }),
  setBudgetMax: (budgetMax) => set({ budgetMax, page: 1 }),
  setPropertyType: (propertyType) => set({ propertyType, page: 1 }),
  setVerifiedOnly: (verifiedOnly) => set({ verifiedOnly, page: 1 }),
  nextPage: () => set((s) => ({ page: s.page + 1 })),
  resetFilters: () =>
    set({
      location: "",
      budgetMin: null,
      budgetMax: null,
      propertyType: null,
      verifiedOnly: false,
      page: 1,
    }),
}));
