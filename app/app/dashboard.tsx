import RoleDashboard from "../components/RoleDashboard";
import { useAuthStore } from "../src/store/authStore";

export default function UserDashboard() {
  const user = useAuthStore(state => state.user);
  const isKycDone = user?.isVerifiedIdentity || user?.demoKycComplete;
  const staffReview = user?.identityVerificationMode === "staff";
  return <RoleDashboard
    role="user"
    title="Your dashboard"
    subtitle="Buy and sell from one account. Check your identity verification status below."
    sections={[
      { title: "Saved properties", description: "Your saved properties.", route: "/saved" },
      { title: staffReview ? "Identity verification" : "KYC (demo)", description: isKycDone ? "Verification step complete." : staffReview ? "An administrator must review your identity before listing or making an offer." : "Complete the demo step before listing or making an offer.", route: "/kyc" },
      { title: "My listings", description: "Track your properties and their verification status.", route: "/my-properties" },
      { title: "Offers and transactions", description: "Manage your inquiries and offers.", route: "/messages" },
    ]}
  />;
}
