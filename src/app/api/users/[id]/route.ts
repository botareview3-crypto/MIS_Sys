import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { USER_ROLES, isValidFullName, isValidUsername } from "@/lib/user-validation";

const EditUserSchema = z.object({
  fullName: z.string().trim(),
  username: z.string().trim(),
  role: z.enum(USER_ROLES),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin"]);
  } catch (e) {
    return apiAuthErrorResponse(e)!;
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ error: "Invalid user account." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = EditUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete every required field." }, { status: 400 });
  }
  const data = parsed.data;

  if (!isValidFullName(data.fullName)) {
    return NextResponse.json({ error: "Full name must contain between 3 and 150 characters." }, { status: 400 });
  }
  if (!isValidUsername(data.username)) {
    return NextResponse.json(
      { error: "Username must contain 3 to 50 letters, numbers, dots, underscores, or hyphens." },
      { status: 400 },
    );
  }
  if (userId === session.userId && data.role !== "Admin") {
    return NextResponse.json({ error: "You cannot remove the Admin role from your own active account." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("The user account no longer exists.");

      const duplicate = await tx.user.findFirst({
        where: { username: { equals: data.username, mode: "insensitive" }, id: { not: userId } },
      });
      if (duplicate) throw new Error("That username is already being used by another account.");

      if (user.role === "Admin" && data.role !== "Admin") {
        const adminCount = await tx.user.count({ where: { role: "Admin" } });
        if (adminCount <= 1) throw new Error("The final Admin account cannot be changed to another role.");
      }

      const changedFields: string[] = [];
      if (user.fullName !== data.fullName) changedFields.push("full_name");
      if (user.username !== data.username) changedFields.push("username");
      if (user.role !== data.role) changedFields.push("role");

      if (changedFields.length === 0) return { noChanges: true };

      await tx.user.update({
        where: { id: userId },
        data: { fullName: data.fullName, username: data.username, role: data.role },
      });

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "user_edited",
          recordType: "user",
          recordId: userId,
          recordReference: data.username,
          actionDetails: { changed_fields: changedFields, previous_role: user.role, new_role: data.role },
          reason: "User account updated by an administrator.",
        },
      });

      return { noChanges: false };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The user account could not be updated.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Mirrors delete-user.php exactly: only soft-deletes Technician accounts, unassigns their repair jobs. */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin"]);
  } catch (e) {
    return apiAuthErrorResponse(e)!;
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1 || userId === session.userId) {
    return NextResponse.json({ error: "Invalid technician account." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const technician = await tx.user.findFirst({
        where: { id: userId, role: "Technician", deletedAt: null },
      });
      if (!technician) throw new Error("The technician account was not found.");

      const unassign = await tx.repairJob.updateMany({
        where: { assignedTechnicianId: userId },
        data: { assignedTechnicianId: null },
      });

      await tx.user.update({
        where: { id: userId },
        data: { isActive: false, deletedAt: new Date() },
      });

      return { fullName: technician.fullName, unassignedCount: unassign.count };
    });

    return NextResponse.json({
      ok: true,
      message: `${result.fullName} was deleted and removed from ${result.unassignedCount} assigned PC${result.unassignedCount === 1 ? "" : "s"}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The technician could not be deleted.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
