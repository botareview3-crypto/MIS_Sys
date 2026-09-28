/**
 * What staff see wherever a device used to be identified by its Job ID.
 * The Job ID (AUC-YYYYMMDD-XXXXXX) is still the permanent internal key —
 * DB unique column, audit `recordReference`, receipts lookups — but the
 * UI shows the hostname instead. Hostname is required at registration, so
 * the fallback only matters for legacy rows that have none.
 */
export function deviceLabel(hostname: string | null | undefined): string {
  return hostname?.trim() || "Unnamed device";
}
