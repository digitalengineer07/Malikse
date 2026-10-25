/**
 * MalikSe — User Listings Store
 * Tracks the count and existence of properties owned by the authenticated user.
 * Used to conditionally display "My listings" in the header navigation menu.
 */
import { create } from "zustand";
import { workflowService } from "../services/workflowService";

interface UserListingsStore {
  listingsCount: number;
  hasListings: boolean;
  isLoading: boolean;
  lastUserId: string | null;
  setListingsCount: (count: number) => void;
  checkUserListings: (userId: string, role?: string, force?: boolean) => Promise<number>;
  reset: () => void;
}

export const useUserListingsStore = create<UserListingsStore>((set, get) => ({
  listingsCount: 0,
  hasListings: false,
  isLoading: false,
  lastUserId: null,

  setListingsCount: (count: number) => {
    set({
      listingsCount: count,
      hasListings: count > 0,
    });
  },

  checkUserListings: async (userId: string, role?: string, force?: boolean) => {
    if (!userId) {
      set({ listingsCount: 0, hasListings: false, lastUserId: null, isLoading: false });
      return 0;
    }
    // Only regular users own properties/listings in MalikSe
    if (role && role !== "user") {
      set({ listingsCount: 0, hasListings: false, lastUserId: userId, isLoading: false });
      return 0;
    }
    // Avoid re-fetching if already checked for this user unless forced
    if (!force && get().lastUserId === userId && get().listingsCount !== null) {
      return get().listingsCount;
    }

    set({ isLoading: true });
    try {
      const data = await workflowService.queue("user");
      const count = Array.isArray(data) ? data.length : 0;
      set({
        listingsCount: count,
        hasListings: count > 0,
        lastUserId: userId,
        isLoading: false,
      });
      return count;
    } catch {
      // If error occurs, leave as is or default gracefully
      set({ isLoading: false });
      return get().listingsCount;
    }
  },

  reset: () => {
    set({
      listingsCount: 0,
      hasListings: false,
      isLoading: false,
      lastUserId: null,
    });
  },
}));
