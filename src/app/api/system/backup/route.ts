import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { generateDatabaseBackup } from "@/lib/backups/generate-backup";

/**
 * On-demand DB backup download. Admin only, matching the original
 * system-backups.php. No file is written to disk — Render's free tier has
 * no persistent disk, so the zip is generated in memory and streamed
 * straight to the response.
 */
export async function GET() {
  let session;
  try {
    session = await requireApiRoles(["Admin"]);
  } catch (e) {
    return apiAuthErrorResponse(e)!;
  }

  const { buffer, filename, tableCount, rowTotal } = await generateDatabaseBackup();

  await prisma.auditLog.create({
    data: {
      performedBy: session.userId,
      actionType: "backup_created",
      recordType: "system_backup",
      recordReference: filename,
      actionDetails: { table_count: tableCount, row_total: rowTotal },
      reason: "On-demand database backup generated and downloaded.",
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
