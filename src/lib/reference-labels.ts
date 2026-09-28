import { prisma } from "@/lib/prisma";

/**
 * Job IDs (AUC-YYYYMMDD-XXXXXX) remain the permanent internal reference —
 * they're what audit rows and notifications store in `recordReference` —
 * but staff-facing screens show the device's hostname instead. These
 * helpers translate at display time, so old rows (which stored the Job ID
 * in their text) render with hostnames too, without touching stored data.
 */
const JOB_ID_PATTERN = "AUC-\\d{8}-[0-9A-F]{6}";

export async function loadHostnamesByJobId(
  texts: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.match(new RegExp(JOB_ID_PATTERN, "g")) ?? []) ids.add(m);
  }
  if (ids.size === 0) return new Map();
  const rows = await prisma.repairJob.findMany({
    where: { jobId: { in: [...ids] } },
    select: { jobId: true, hostname: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.hostname?.trim()) map.set(r.jobId, r.hostname.trim());
  }
  return map;
}

/** Replaces every Job ID in `text` that has a known hostname. */
export function withHostnames(text: string | null | undefined, map: Map<string, string>): string {
  if (!text) return "";
  return text.replace(new RegExp(JOB_ID_PATTERN, "g"), (id) => map.get(id) ?? id);
}

/** Job IDs whose device hostname matches a search term, so searching by hostname still finds audit rows. */
export async function jobIdsMatchingHostname(search: string): Promise<string[]> {
  if (!search) return [];
  const rows = await prisma.repairJob.findMany({
    where: { hostname: { contains: search, mode: "insensitive" } },
    select: { jobId: true },
    take: 200,
  });
  return rows.map((r) => r.jobId);
}
