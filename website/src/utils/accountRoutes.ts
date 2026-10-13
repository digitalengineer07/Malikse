import type { UserRole } from "../types/auth.types";

export const dashboardRoutes = {
  user: "/dashboard",
  advisor: "/advisor/dashboard",
  verifier: "/verifier/dashboard",
  admin: "/admin/dashboard",
} as const satisfies Record<UserRole, string>;

export const roleLabels: Record<UserRole, string> = {
  user: "User",
  advisor: "Advisor",
  verifier: "Verifier",
  admin: "Admin",
};
