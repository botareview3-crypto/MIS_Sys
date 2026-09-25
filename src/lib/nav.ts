import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PlusSquare,
  HardDrive,
  ClipboardList,
  Bell,
  Users,
  BarChart3,
  ShieldCheck,
  HardDriveDownload,
  MapPin,
  Network,
} from "lucide-react";
import type { SessionPayload } from "@/lib/auth";

export type NavItem = {
  // Parent/group items (Local, Intra) omit href and carry children instead.
  href?: string;
  label: string;
  icon: LucideIcon;
  showBadge?: boolean;
  children?: NavItem[];
};

/**
 * Mirrors includes/sidebar.php exactly:
 * - Register Device: Admin, Reception, Technician (NOT Secondary Admin)
 * - Notifications: everyone except Admin, in Workspace group;
 *   Admin also gets it, but inside the Administration group instead.
 * - Administration group: Admin only.
 *
 * "Local" / "Intra" split (added 2026-09-25): the existing device
 * register/manage items now live under two collapsible groups instead of
 * flat in Workspace. Both groups currently point at the SAME routes/pages
 * — this is a nav-structure-only change for now. The project owner intends
 * to split Local vs. Intra into genuinely different configurations
 * (routes/data/behavior) later; do not invent that split yet.
 */
export function getNavGroups(role: SessionPayload["role"]) {
  const isAdmin = role === "Admin";
  const isReception = role === "Reception";
  const isTechnician = role === "Technician";

  const deviceItems: NavItem[] = [
    ...(isAdmin || isReception || isTechnician
      ? [{ href: "/devices/register", label: "Register Device", icon: PlusSquare }]
      : []),
    { href: "/devices", label: "Manage Devices", icon: HardDrive },
  ];

  const workspace: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { label: "Local", icon: MapPin, children: deviceItems },
    { label: "Intra", icon: Network, children: deviceItems },
    { href: "/work-queue", label: "Work Queue", icon: ClipboardList },
    ...(!isAdmin
      ? [{ href: "/notifications", label: "Notifications", icon: Bell, showBadge: true }]
      : []),
  ];

  const administration: NavItem[] = isAdmin
    ? [
        { href: "/notifications", label: "Notifications", icon: Bell, showBadge: true },
        { href: "/users", label: "Manage Users", icon: Users },
        { href: "/reports", label: "Reports & History", icon: BarChart3 },
        { href: "/audit-history", label: "Audit History", icon: ShieldCheck },
        { href: "/system-backups", label: "Database Backup", icon: HardDriveDownload },
      ]
    : [];

  return { workspace, administration };
}
