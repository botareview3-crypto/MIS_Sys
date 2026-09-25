import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type ReferenceColumn = "jobId" | "receiptNumber";

/** Mirrors generateUniqueReference() in the original register-device.php. */
export async function generateUniqueReference(
  column: ReferenceColumn,
  prefix: "AUC" | "REC",
): Promise<string> {
  const today = new Date();
  const datePart = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(
    today.getUTCDate(),
  ).padStart(2, "0")}`;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const reference = `${prefix}-${datePart}-${suffix}`;
    const existing = await prisma.repairJob.findFirst({
      where: { [column]: reference },
      select: { id: true },
    });
    if (!existing) return reference;
  }
}
