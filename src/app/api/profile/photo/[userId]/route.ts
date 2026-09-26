import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ userId: string }> };

/**
 * Ported from app/pages/users/profile-image.php. Any authenticated user can
 * view any other user's photo — that matches the original, which only
 * requires a valid session (includes/auth.php), not a role or self check;
 * avatars are shown across the app (sidebar, audit history, etc).
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return new NextResponse("Not Found", { status: 404 });

  const { userId } = await params;
  const id = Number(userId);
  if (!Number.isInteger(id) || id < 1) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const image = await prisma.userProfileImage.findUnique({ where: { userId: id } });
  if (!image) return new NextResponse("Not Found", { status: 404 });

  const etag = `"${image.checksum}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }

  const contents = Buffer.from(image.imageData, "base64");
  return new NextResponse(contents, {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(contents.length),
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=86400, immutable",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
