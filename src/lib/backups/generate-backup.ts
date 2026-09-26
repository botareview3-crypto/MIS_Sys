import JSZip from "jszip";
import { prisma } from "@/lib/prisma";

/**
 * On-demand database backup — ported from Arp-main/includes/backup-engine.php's
 * data-dump logic, but streamed straight to the browser instead of being
 * written to local disk. Render's free-tier filesystem is ephemeral (no
 * persistent disk on this plan), so anything written to disk here would be
 * gone on the next deploy/restart anyway. Neon also runs its own automated
 * backups independently — this is an on-demand export for the admin, not
 * the only line of defense.
 *
 * Produces a .zip containing:
 *   - data.sql      -- INSERT statements for every table, in dependency-safe
 *                       order, plus sequence setval() calls
 *   - manifest.json -- generated_at, table list, per-table row counts
 */

const FORMAT_VERSION = 1;

// Same ordering rationale as the PHP version: FK-dependency-safe order first,
// then anything else found in the DB that isn't in this list.
const PREFERRED_TABLE_ORDER = [
  "users",
  "user_profile_images",
  "customers",
  "repair_jobs",
  "accessories",
  "status_history",
  "receipts",
  "whatsapp_logs",
  "audit_logs",
  "notifications",
  "password_reset_tokens",
  "login_attempts",
];

type ColumnInfo = { column_name: string; data_type: string };

function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown, dataType: string): string {
  if (value === null || value === undefined) return "NULL";
  if (dataType === "boolean") return value ? "TRUE" : "FALSE";
  if (
    ["smallint", "integer", "bigint", "numeric", "decimal", "real", "double precision"].includes(dataType) &&
    !Number.isNaN(Number(value))
  ) {
    return String(value);
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function getTables(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const available = rows.map((r) => r.tablename);
  const ordered = PREFERRED_TABLE_ORDER.filter((t) => available.includes(t));
  for (const t of available) {
    if (!ordered.includes(t)) ordered.push(t);
  }
  return ordered;
}

async function getColumns(table: string): Promise<ColumnInfo[]> {
  return prisma.$queryRawUnsafe<ColumnInfo[]>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    table
  );
}

export async function generateDatabaseBackup(): Promise<{ buffer: Buffer; filename: string; tableCount: number; rowTotal: number }> {
  const tables = await getTables();
  const rowCounts: Record<string, number> = {};
  const lines: string[] = [`-- AUC MIS data backup`, `-- Generated: ${new Date().toISOString()}`, ""];

  for (const table of tables) {
    const columns = await getColumns(table);
    if (columns.length === 0) continue;

    const columnNames = columns.map((c) => c.column_name);
    const quotedColumns = columnNames.map(quoteIdent).join(", ");
    const tableIdent = `public.${quoteIdent(table)}`;

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM ${tableIdent} ORDER BY 1`
    );

    let rowCount = 0;
    for (const row of rows) {
      const values = columns.map((c) => sqlLiteral(row[c.column_name], c.data_type));
      lines.push(`INSERT INTO ${tableIdent} (${quotedColumns}) VALUES (${values.join(", ")});`);
      rowCount++;
    }
    rowCounts[table] = rowCount;
    lines.push("");
  }

  const sequences = await prisma.$queryRawUnsafe<{ sequence_name: string }[]>(
    `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' ORDER BY sequence_name`
  );
  for (const { sequence_name } of sequences) {
    const state = await prisma.$queryRawUnsafe<{ last_value: string; is_called: boolean }[]>(
      `SELECT last_value, is_called FROM public.${quoteIdent(sequence_name)}`
    );
    if (state[0]) {
      lines.push(
        `SELECT pg_catalog.setval('public.${sequence_name.replace(/'/g, "''")}', ${state[0].last_value}, ${
          state[0].is_called ? "TRUE" : "FALSE"
        });`
      );
    }
  }
  lines.push("", "-- AUC MIS DATA BACKUP COMPLETE");

  const rowTotal = Object.values(rowCounts).reduce((a, b) => a + b, 0);
  const manifest = {
    format_version: FORMAT_VERSION,
    generated_at: new Date().toISOString(),
    table_count: tables.length,
    row_counts: rowCounts,
    row_total: rowTotal,
  };

  const zip = new JSZip();
  zip.file("data.sql", lines.join("\n"));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  const filename = `auc_mis_backup_${stamp}.zip`;

  return { buffer, filename, tableCount: tables.length, rowTotal };
}
