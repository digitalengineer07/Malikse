import RoleDashboard from "../../components/RoleDashboard";
export default function Dashboard() {
 return <RoleDashboard role="advisor" title="Advisor dashboard" subtitle="Review assigned properties and send approved listings to verification." sections={[
 { title: "Property reviews", description: "Open assigned reviews, claim new work and view past decisions.", route: "/advisor/properties" },
 { title: "Verified marketplace", description: "Browse published properties.", route: "/search" },
 ]} />;
}
