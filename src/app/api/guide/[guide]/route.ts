import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import {
  GuideError,
  deleteStep,
  insertStep,
  isGuideImageUrl,
  isGuideKey,
  resetGuide,
} from "@/lib/guide-store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ guide: string }> };

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("insert"),
    afterId: z.string().min(1).nullable(),
    step: z.object({
      title: z.string().trim().min(1, "Enter a title for the step.").max(200),
      description: z.string().trim().max(2000).default(""),
      category: z.string().trim().max(60).optional(),
      image: z.string().max(200).optional(),
    }),
  }),
  z.object({ action: z.literal("delete"), id: z.string().min(1) }),
  z.object({ action: z.literal("reset") }),
]);

/** Add / delete a guide step, or reset the guide to its built-in content. Admin + Secondary Admin only. */
export async function POST(req: NextRequest, { params }: RouteContext) {
  let session;
  try {
    session = await requireApiRoles(["Admin", "Secondary Admin"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const { guide } = await params;
  if (!isGuideKey(guide)) {
    return NextResponse.json({ error: "Unknown guide." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "The request was not valid." },
      { status: 400 },
    );
  }
  const data = parsed.data;

  try {
    if (data.action === "insert") {
      if (data.step.image && !isGuideImageUrl(data.step.image)) {
        return NextResponse.json({ error: "The step photo is not valid." }, { status: 400 });
      }
      const created = await insertStep(
        guide,
        data.afterId,
        {
          title: data.step.title,
          description: data.step.description,
          category: data.step.category || undefined,
          image: data.step.image || undefined,
        },
        session.userId,
      );
      return NextResponse.json({ ok: true, ...created });
    }

    if (data.action === "delete") {
      await deleteStep(guide, data.id, session.userId);
      return NextResponse.json({ ok: true });
    }

    await resetGuide(guide);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof GuideError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("guide edit failed:", e);
    return NextResponse.json(
      {
        error:
          "The guide could not be saved. If this is the first time guide editing is used, the guide_contents and guide_images tables may not exist yet (see docs/sql/2026-09-30-guide-editing.sql).",
      },
      { status: 500 },
    );
  }
}
