import React from "react";
import RoleDashboard from "../components/RoleDashboard";
import { useAuthStore } from "../src/store/authStore";

export default function UserDashboard() {
  const user = useAuthStore((state) => state.user);
  const isKycDone = Boolean(user?.isVerifiedIdentity || user?.demoKycComplete);
  const staffReview = user?.identityVerificationMode === "staff";

  return (
    <RoleDashboard
      role="user"
      title="Your Command Center"
      subtitle="Manage your properties, saved homes, KYC status, and buyer messages."
      sections={[
        {
          title: "My Listings",
          description: "Manage properties you posted and check buyer interest.",
          route: "/my-properties",
          icon: "home-work",
          tag: "Portfolio",
          accentColor: "#0A45B5",
          actionLabel: "Manage listings",
        },
        {
          title: "Saved Properties",
          description: "View and compare properties you bookmarked.",
          route: "/saved",
          icon: "bookmark-border",
          tag: "Wishlist",
          accentColor: "#E11D48",
          actionLabel: "View saved",
        },
        {
          title: "Identity & KYC",
          description: isKycDone
            ? "Your identity is verified. You can list properties and make offers."
            : staffReview
            ? "Upload your ID to unlock property posting and verified deals."
            : "Quick verification to list properties and contact owners directly.",
          route: "/kyc",
          icon: "verified-user",
          tag: isKycDone ? "Verified ✓" : "Required",
          accentColor: "#059669",
          actionLabel: isKycDone ? "View status" : "Verify now",
        },
        {
          title: "Chats & Inquiries",
          description: "Chat with buyers, sellers, and your assigned advisor.",
          route: "/messages",
          icon: "chat-bubble-outline",
          tag: "Messages",
          accentColor: "#7C3AED",
          actionLabel: "Open chats",
        },
        {
          title: "Draw Plot on Map",
          description: "Pin boundary points on satellite map to calculate area in Kattha & Sq.Ft.",
          route: "/post",
          icon: "layers",
          tag: "Satellite Map",
          accentColor: "#0284C7",
          actionLabel: "Start mapping",
        },
        {
          title: "Circle Rates & Trends",
          description: "Check government circle rates and locality price trends.",
          route: "/insights",
          icon: "insights",
          tag: "Price Trends",
          accentColor: "#0F766E",
          actionLabel: "View rates",
        },
      ]}
    />
  );
}
