import type { ComponentProps } from "react";
import { Link } from "@/web/navigation";
export function ExternalLink(props: ComponentProps<typeof Link>) { return <Link {...props} target="_blank" rel="noopener noreferrer" />; }
