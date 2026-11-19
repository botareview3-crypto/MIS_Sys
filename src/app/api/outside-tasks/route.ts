import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prismaOutside, outsideTasksConfigured } from "@/lib/prisma-outside";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { OUTSIDE_TASK_ISSUES } from "@/lib/outside-tasks";

const Schema = z.object({
  customerName: z.string().trim().min(1).max(150),
  issue: z.enum(OUTSIDE_TASK_ISSUES),
  notes: z.string().trim().max(2000).optional().default(""),
});

// Every role can log their own outside-office work.
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Secondary Admin", "Reception", "Technician"]);
  } catch (e) {
    return apiAuthErrorResponse(e) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  if (!outsideTasksConfigured) {
    return NextResponse.json({ error: "Outside Tasks storage is not set up yet. Ask an administrator." }, { status: 503 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter the customer name and pick an issue." }, { status: 400 });
  }
  const { customerName, issue, notes } = parsed.data;

  // userId comes from the session, never from the request body.
  // loggedAt is set here (UTC) so the date is never typed by the user.
  try {
    const task = await prismaOutside.outsideTask.create({
    data: {
      userId: session.userId,
      userFullName: session.fullName,
      customerName,
      issue,
      notes: notes === "" ? null : notes,
      loggedAt: new Date(),
    },
    });
    return NextResponse.json({ ok: true, id: task.id });
  } catch (e) {
    console.error("outside-tasks create failed", e);
    return NextResponse.json({ error: "The task could not be saved. Please try again." }, { status: 500 });
  }
}
