import RoleDashboard from "../components/RoleDashboard";
import { useAuthStore } from "../src/store/authStore";

export default function UserDashboard() {
  const isKycDone = useAuthStore((state) => state.user?.demoKycComplete);
  return <RoleDashboard
    role="user"
    title="Your dashboard"
    subtitle="Buy and sell from one account. The KYC step is a demo placeholder."
    sections={[
      { title: "Saved properties", description: "Your saved properties.", route: "/saved" },
      { title: "KYC (demo)", description: isKycDone ? "Demo step completed." : "Mark the demo KYC step complete before listing or making an offer.", route: "/kyc" },
      { title: "My listings", description: "Track your properties and their verification status.", route: "/my-properties" },
      { title: "Offers and transactions", description: "Manage your inquiries and offers.", route: "/messages" },
    ]}
  />;
}
