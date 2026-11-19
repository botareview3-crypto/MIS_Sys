import type { SessionPayload } from "@/lib/auth";

/**
 * Dropdown choices for the "Issue" field on the Outside Tasks form.
 * EDIT THIS LIST to match the real jobs — the form and the API both read it,
 * so nothing else needs to change. Keep "Other" last (notes explain it).
 * Entries already logged keep whatever text they were saved with.
 */
export const OUTSIDE_TASK_ISSUES = [
  "PC configuration / software installation",
  "Network / Wi-Fi / cable issue",
  "Printer / scanner issue",
  "Outlook / email setup",
  "Password or account reset",
  "Hardware fault (on-site)",
  "Device pickup / delivery",
  "Other",
] as const;

/** Admin and Secondary Admin see everyone's entries; everyone else sees only their own. */
export function canViewAllOutsideTasks(role: SessionPayload["role"]) {
  return role === "Admin" || role === "Secondary Admin";
}

/** Timestamps are stored as UTC (naive column); show them in Addis Ababa time. */
export function formatLoggedAt(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
