import { Redirect } from "@/web/navigation";

// The root layout owns the startup loader, including when opening a deep link.
export default function Index() {
  return <Redirect href="/home" />;
}
