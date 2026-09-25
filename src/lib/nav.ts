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
} from "lucide-react";
import type { SessionPayload } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  showBadge?: boolean;
};

/**
 * Mirrors includes/sidebar.php exactly:
 * - Register Device: Admin, Reception, Technician (NOT Secondary Admin)
 * - Notifications: everyone except Admin, in Workspace group;
 *   Admin also gets it, but inside the Administration group instead.
 * - Administration group: Admin only.
 */
export function getNavGroups(role: SessionPayload["role"]) {
  const isAdmin = role === "Admin";
  const isReception = role === "Reception";
  const isTechnician = role === "Technician";

  const workspace: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(isAdmin || isReception || isTechnician
      ? [{ href: "/devices/register", label: "Register Device", icon: PlusSquare }]
      : []),
    { href: "/devices", label: "Manage Devices", icon: HardDrive },
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
