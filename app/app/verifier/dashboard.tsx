import RoleDashboard from "../../components/RoleDashboard";
export default function Dashboard() {
 return <RoleDashboard role="verifier" title="Verifier dashboard" subtitle="Review Advisor-approved properties and publish after final approval." sections={[
 { title: "Pending reviews and history", description: "Open assigned work, claim unassigned reviews, approve, request corrections or reject.", route: "/verifier/properties" },
 { title: "Message admin", description: "Raise a review issue or follow up on a support request.", route: "/support" },
 { title: "Verified marketplace", description: "Browse published properties.", route: "/search" },
 ]} />;
}
