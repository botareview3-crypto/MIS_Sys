import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";
import { USER_ROLES, isValidFullName, isValidUsername, isValidNewPassword } from "@/lib/user-validation";

const AddUserSchema = z.object({
  fullName: z.string().trim(),
  username: z.string().trim(),
  password: z.string(),
  passwordConfirmation: z.string(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireApiRoles(["Admin"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = AddUserSchema.safeParse(body);
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
  if (!isValidNewPassword(data.password)) {
    return NextResponse.json({ error: "Password must contain between 8 and 255 characters." }, { status: 400 });
  }
  if (data.password !== data.passwordConfirmation) {
    return NextResponse.json({ error: "The password confirmation does not match." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newUser = await prisma.$transaction(async (tx: any) => {
      if (data.role === "Secondary Admin") {
        const existing = await tx.user.findFirst({
          where: { role: "Secondary Admin", deletedAt: null },
        });
        if (existing) throw new Error("Only one Secondary Admin account can be created.");
      }

      const duplicate = await tx.user.findFirst({
        where: { username: { equals: data.username, mode: "insensitive" } },
      });
      if (duplicate) throw new Error("That username is already being used.");

      const passwordHash = await hashPassword(data.password);

      const created = await tx.user.create({
        data: {
          fullName: data.fullName,
          username: data.username,
          password: passwordHash,
          role: data.role,
          isActive: data.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          performedBy: session.userId,
          actionType: "user_created",
          recordType: "user",
          recordId: created.id,
          recordReference: created.username,
          actionDetails: {
            new_user_id: created.id,
            full_name: created.fullName,
            username: created.username,
            role: created.role,
            profile_image_uploaded: false,
          },
          reason: "New user account created by an administrator.",
        },
      });

      return created;
    });

    return NextResponse.json({ ok: true, userId: newUser.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The new user account could not be created.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
