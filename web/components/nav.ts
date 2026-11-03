import {
  BookOpen,
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  MessageSquare,
  Network,
  Package,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  managerOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/catalog", label: "Catalog", icon: Boxes },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/prompt-studio", label: "Prompt Studio", icon: Sparkles },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, managerOnly: true },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck, managerOnly: true },
  { href: "/architecture", label: "Architecture", icon: Network },
];

/** Routes anyone can open without signing in (for interviewers). */
export const PUBLIC_ROUTES = ["/architecture"];
export const MANAGER_ROUTES = NAV_ITEMS.filter((i) => i.managerOnly).map((i) => i.href);

/** The four tabs shown in the mobile bottom bar; everything else lives under "More". */
export function primaryTabs(isManager: boolean): string[] {
  return isManager ? ["/chat", "/orders", "/dashboard", "/approvals"] : ["/chat", "/orders", "/catalog", "/knowledge"];
}

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function matchesRoute(pathname: string, routes: string[]) {
  return routes.some((r) => isActive(pathname, r));
}
