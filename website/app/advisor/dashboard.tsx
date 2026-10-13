import RoleDashboard from "../../components/RoleDashboard";
export default function Dashboard() {
 return <RoleDashboard role="advisor" title="Advisor dashboard" subtitle="Review submitted properties and send approved listings to a Verifier." sections={[
 { title: "Pending reviews and history", description: "Open assigned work, claim unassigned reviews, approve, request corrections or reject.", route: "/advisor/properties" },
 { title: "Verified marketplace", description: "Browse published properties.", route: "/search" },
 ]} />;
}
