import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

const StatusSchema = z.object({ action: z.enum(["deactivate", "reactivate"]) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ error: "The selected user account is invalid." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "The requested account action is invalid." }, { status: 400 });
  }
  const { action } = parsed.data;

  if (action === "deactivate" && userId === session.userId) {
    return NextResponse.json({ error: "You cannot deactivate your own active account." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("The selected user account no longer exists.");

      if (action === "deactivate" && !user.isActive) throw new Error("That account is already inactive.");
      if (action === "reactivate" && user.isActive) throw new Error("That account is already active.");

      if (action === "deactivate" && user.role === "Admin") {
        const activeAdminCount = await tx.user.count({ where: { role: "Admin", isActive: true } });
        if (activeAdminCount <= 1) throw new Error("The final active Admin account cannot be deactivated.");
      }

      await tx.user.update({ where: { id: userId }, data: { isActive: action === "reactivate" } });

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: action === "reactivate" ? "user_reactivated" : "user_deactivated",
          recordType: "user",
          recordId: userId,
          recordReference: user.username,
          actionDetails: {
            user_id: user.id,
            full_name: user.fullName,
            username: user.username,
            role: user.role,
            previous_status: user.isActive,
          },
          reason: `Account ${action}d by an administrator.`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The account status could not be updated.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
