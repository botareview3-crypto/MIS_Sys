import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { encryptCredential } from "@/lib/credentials";
import { resolveReportedProblem } from "@/lib/reported-problems";
import { generateUniqueReference } from "@/lib/reference";

const RegisterDeviceSchema = z.object({
  title: z.enum(["Mr", "Ms", ""]).optional().default(""),
  customerFullName: z.string().trim().min(1).max(150),
  phoneNumber: z.string().trim().min(1).max(30),
  outlookEmail: z.string().trim().min(1), // local part or full address; normalized below
  outlookPassword: z.string().default(""),
  regionalOffice: z.string().trim().max(150).optional().default(""),
  givenByName: z.string().trim().min(1).max(150),
  aucAssetBarcode: z.string().trim().min(1),
  serialNumber: z.string().trim().min(1),
  macAddress: z.string().trim().max(50).optional().default(""),
  hostname: z.string().trim().max(255).optional().default(""),
  reportedProblemType: z.string().default(""),
  reportedProblemCustom: z.string().default(""),
  assignedTechnicianId: z.string().default(""),
  expectedCompletionDate: z.string().default(""), // "" or YYYY-MM-DD
  chargerReceived: z.boolean().default(false),
  networkCableBarcode: z.string().trim().default(""),
  bagReceived: z.boolean().default(false),
});

/** Ported from register-device.php's normalizeAucOutlookEmail(). Returns null if invalid. */
function normalizeAucOutlookEmail(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (v === "") return "";
  const [localPart, domain] = v.split("@");
  if (!localPart || (domain !== undefined && domain !== "africanunion.org")) return null;
  const email = `${localPart}@africanunion.org`;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Reception", "Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = RegisterDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete every required field." }, { status: 400 });
  }
  const data = parsed.data;
  const isTechnician = session.role === "Technician";

  const normalizedEmail = normalizeAucOutlookEmail(data.outlookEmail);
  if (normalizedEmail === null) {
    return NextResponse.json(
      { error: "Please enter a valid African Union Outlook username. The @africanunion.org domain is added automatically." },
      { status: 400 },
    );
  }

  const reportedProblem = resolveReportedProblem(data.reportedProblemType, data.reportedProblemCustom);
  const assignedTechnicianId = isTechnician ? "" : data.assignedTechnicianId;

  if (
    data.customerFullName === "" ||
    data.phoneNumber === "" ||
    normalizedEmail === "" ||
    data.givenByName === "" ||
    data.aucAssetBarcode === "" ||
    data.serialNumber === "" ||
    reportedProblem === ""
  ) {
    return NextResponse.json({ error: "Please complete every required field." }, { status: 400 });
  }
  if (assignedTechnicianId !== "" && !/^\d+$/.test(assignedTechnicianId)) {
    return NextResponse.json({ error: "Please select a valid Technician." }, { status: 400 });
  }
  if (data.expectedCompletionDate) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(data.expectedCompletionDate);
    const todayUtc = new Date().toISOString().slice(0, 10);
    if (!valid) {
      return NextResponse.json({ error: "Please enter a valid expected completion date." }, { status: 400 });
    }
    if (data.expectedCompletionDate < todayUtc) {
      return NextResponse.json({ error: "The expected completion date cannot be in the past." }, { status: 400 });
    }
  }

  // Duplicate detection - same fields, case-insensitive, trimmed, as the original.
  const duplicate = await prisma.repairJob.findFirst({
    where: {
      OR: [
        { aucAssetBarcode: { equals: data.aucAssetBarcode, mode: "insensitive" } },
        { serialNumber: { equals: data.serialNumber, mode: "insensitive" } },
        ...(data.macAddress ? [{ macAddress: { equals: data.macAddress, mode: "insensitive" as const } }] : []),
        ...(data.hostname ? [{ hostname: { equals: data.hostname, mode: "insensitive" as const } }] : []),
      ],
    },
  });

  if (duplicate) {
    const macMatch = data.macAddress && duplicate.macAddress?.toLowerCase() === data.macAddress.toLowerCase();
    const hostnameMatch = data.hostname && duplicate.hostname?.toLowerCase() === data.hostname.toLowerCase();
    const barcodeMatch = duplicate.aucAssetBarcode.toLowerCase() === data.aucAssetBarcode.toLowerCase();
    const serialMatch = duplicate.serialNumber.toLowerCase() === data.serialNumber.toLowerCase();

    let error = "This manufacturer serial number is already registered.";
    if (macMatch) error = "This MAC address is already registered.";
    else if (hostnameMatch) error = "This hostname is already registered.";
    else if (barcodeMatch && serialMatch) error = "The AUC barcode and serial number are already registered.";
    else if (barcodeMatch) error = "This AUC asset barcode is already registered.";

    return NextResponse.json({ error, duplicate: true }, { status: 409 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      let technicianId: number | null = assignedTechnicianId ? Number(assignedTechnicianId) : null;
      let secondaryAdminId: number | null = null;

      if (technicianId !== null) {
        const candidate = await tx.user.findFirst({
          where: {
            id: technicianId,
            isActive: true,
            deletedAt: null,
            role: { in: ["Technician", "Secondary Admin", "Admin"] },
          },
        });
        if (!candidate) throw new Error("The selected Technician account is invalid.");
        if (candidate.role === "Secondary Admin") {
          secondaryAdminId = technicianId;
          technicianId = null;
        }
      }

      const encryptedOutlookPassword = encryptCredential(data.outlookPassword);
      const jobId = await generateUniqueReference("jobId", "AUC");
      const receiptNumber = await generateUniqueReference("receiptNumber", "REC");

      const customer = await tx.customer.create({
        data: {
          title: data.title || null,
          fullName: data.customerFullName,
          phoneNumber: data.phoneNumber,
          outlookEmail: normalizedEmail,
          outlookPasswordEncrypted: encryptedOutlookPassword,
          regionalOffice: data.regionalOffice || null,
          createdBy: session.userId,
        },
      });

      const repairJob = await tx.repairJob.create({
        data: {
          jobId,
          receiptNumber,
          customerId: customer.id,
          aucAssetBarcode: data.aucAssetBarcode,
          serialNumber: data.serialNumber,
          macAddress: data.macAddress || null,
          hostname: data.hostname || null,
          reportedProblem,
          assignedTechnicianId: technicianId,
          assignedSecondaryAdminId: secondaryAdminId,
          expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
          status: "Received",
          givenByName: data.givenByName,
          acceptedBy: session.userId,
        },
      });

      await tx.accessories.create({
        data: {
          repairJobId: repairJob.id,
          chargerReceived: data.chargerReceived,
          networkCableBarcode: data.networkCableBarcode || null,
          bagReceived: data.bagReceived,
        },
      });

      await tx.statusHistory.create({
        data: {
          repairJobId: repairJob.id,
          previousStatus: null,
          newStatus: "Received",
          changedBy: session.userId,
          changeNote: "Device registered and received by MIS.",
        },
      });

      await tx.receipt.create({
        data: {
          repairJobId: repairJob.id,
          receiptType: "Receiving",
          receiptReference: receiptNumber,
          createdBy: session.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "CREATE",
          recordType: "repair_job",
          recordId: repairJob.id,
          recordReference: jobId,
          actionDetails: {
            job_id: jobId,
            receipt_number: receiptNumber,
            customer_id: customer.id,
            registration_type: "standard",
            hostname: data.hostname || null,
            initial_status: "Received",
            assigned_technician_id: technicianId,
            assigned_secondary_admin_id: secondaryAdminId,
          },
        },
      });

      if (isTechnician) {
        const admins = await tx.user.findMany({
          where: { isActive: true, deletedAt: null, role: { in: ["Admin", "Secondary Admin"] } },
          select: { id: true },
        });
        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((admin: { id: number }) => ({
              recipientUserId: admin.id,
              createdBy: session.userId,
              notificationType: "device_registered",
              title: "Device registered by technician",
              message: `${session.fullName} registered device ${jobId} for ${data.customerFullName}.`,
              recordReference: jobId,
            })),
          });
        }
      }

      return { jobId, receiptNumber, repairJobId: repairJob.id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Device registration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
