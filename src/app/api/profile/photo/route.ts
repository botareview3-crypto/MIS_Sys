import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PROFILE_IMAGE_MAX_BYTES, sniffImageMime, profileImageUrl } from "@/lib/profile-images";

/**
 * Ported from app/pages/users/profile.php (the POST branch) plus
 * includes/profile-images.php's storeProfileImage()/persistProfileImage().
 * The original stages the upload to disk then copies it into the
 * user_profile_images table; there's no need for that two-step dance here,
 * so this validates the upload and writes straight to the row.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "The profile photo could not be uploaded. Please try again." }, { status: 400 });
  }

  const file = form.get("profile_image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a new photo or select Remove Photo." }, { status: 400 });
  }

  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Profile photos must be smaller than 5 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffImageMime(buffer);
  if (!mimeType) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP image for the profile photo." }, { status: 400 });
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");

  await prisma.userProfileImage.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, mimeType, imageData: buffer.toString("base64"), checksum },
    update: { mimeType, imageData: buffer.toString("base64"), checksum },
  });

  const updatedPath = profileImageUrl(session.userId, checksum);
  await prisma.user.update({
    where: { id: session.userId },
    data: { profileImagePath: updatedPath },
  });

  return NextResponse.json({ ok: true, profileImagePath: updatedPath });
}

/** Ported from the $removeProfileImage branch of profile.php + deletePersistedProfileImage(). */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await prisma.userProfileImage.deleteMany({ where: { userId: session.userId } });
  await prisma.user.update({ where: { id: session.userId }, data: { profileImagePath: null } });

  return NextResponse.json({ ok: true });
}
