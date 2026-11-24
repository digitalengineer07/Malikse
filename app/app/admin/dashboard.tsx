import RoleDashboard from "../../components/RoleDashboard";
export default function AdminDashboard() {
 return <RoleDashboard role="admin" title="Admin dashboard" subtitle="Manage staff and track the complete property verification workflow." sections={[
 { title: "Verifier chats", description: "Read and reply to messages from verifiers.", route: "/(tabs)/messages" },
 { title: "Support inbox", description: "Read and reply to support requests from users and staff.", route: "/support" },
 { title: "Advisors and Verifiers", description: "Register staff and view their accounts.", route: "/admin/staff" },
 { title: "User accounts", description: "View all registered users and their property listings.", route: "/admin/users" },
 { title: "Properties and verification history", description: "Track sellers, reviewers, reports, corrections and approvals. Assign pending reviews.", route: "/admin/properties" },
 { title: "Verified marketplace", description: "Browse published properties.", route: "/search" },
 ]} />;
}
