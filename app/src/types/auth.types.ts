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
  isVerifiedIdentity: boolean;
  demoKycComplete?: boolean;
  kycDocuments?: string[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
