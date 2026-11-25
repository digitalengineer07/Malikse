/**
 * MalikSe — Auth Types
 */

export type UserRole = "user" | "advisor" | "verifier" | "admin";

export interface UserProfile {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  role: UserRole;
  advisorCode?: string;
  assignedDistricts?: string[];
  isVerifiedIdentity: boolean;
  demoKycComplete?: boolean;
  identityVerificationMode?: "staff" | "demo";
  kycDocuments?: string[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
