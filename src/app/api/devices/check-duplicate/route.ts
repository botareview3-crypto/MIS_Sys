import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

// Live per-field check while filling out Register Device, so a duplicate
// PC barcode/serial/MAC/hostname surfaces as soon as the field is left,
// instead of only after the whole (possibly multi-device) form is
// submitted. This mirrors the same case-insensitive equality check the
// register route itself does at submit time — that one is still the real
// gate; this is just an earlier heads-up.
const ALLOWED_FIELDS = ["aucAssetBarcode", "serialNumber", "macAddress", "hostname"] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

function isAllowedField(value: string | null): value is AllowedField {
  return !!value && (ALLOWED_FIELDS as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
  try {
    await requireApiRoles(["Admin", "Reception", "Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const field = req.nextUrl.searchParams.get("field");
  const value = (req.nextUrl.searchParams.get("value") ?? "").trim();

  if (!isAllowedField(field) || !value) {
    return NextResponse.json({ duplicate: false });
  }

  let existing;
  switch (field) {
    case "aucAssetBarcode":
      existing = await prisma.repairJob.findFirst({
        where: { aucAssetBarcode: { equals: value, mode: "insensitive" } },
        select: { id: true },
      });
      break;
    case "serialNumber":
      existing = await prisma.repairJob.findFirst({
        where: { serialNumber: { equals: value, mode: "insensitive" } },
        select: { id: true },
      });
      break;
    case "macAddress":
      existing = await prisma.repairJob.findFirst({
        where: { macAddress: { equals: value, mode: "insensitive" } },
        select: { id: true },
      });
      break;
    case "hostname":
      existing = await prisma.repairJob.findFirst({
        where: { hostname: { equals: value, mode: "insensitive" } },
        select: { id: true },
      });
      break;
  }

  return NextResponse.json({ duplicate: !!existing });
}
