import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";
import { sniffImageMime } from "@/lib/profile-images";

const GUIDE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** Stores a photo for a new guide step (the page shrinks it before upload). Admin + Secondary Admin only. */
export async function POST(req: NextRequest) {
  try {
    await requireApiRoles(["Admin", "Secondary Admin"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  }
  if (file.size > GUIDE_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Photos must be smaller than 8 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffImageMime(buffer);
  if (!mimeType) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP photo." }, { status: 400 });
  }

  try {
    const row = await prisma.guideImage.create({
      data: { mimeType, imageData: buffer.toString("base64") },
    });
    return NextResponse.json({ ok: true, url: `/api/guide/images/${row.id}` });
  } catch (e) {
    console.error("guide image upload failed:", e);
    return NextResponse.json(
      { error: "The photo could not be saved. The guide_images table may not exist yet (see docs/sql/2026-09-30-guide-editing.sql)." },
      { status: 500 },
    );
  }
}
