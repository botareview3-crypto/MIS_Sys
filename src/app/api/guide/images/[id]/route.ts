import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

/** Serves a guide step photo uploaded through the app. Any signed-in user can view it. */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return new NextResponse("Not Found", { status: 404 });

  const { id } = await params;
  const imageId = Number(id);
  if (!Number.isInteger(imageId) || imageId < 1) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const image = await prisma.guideImage.findUnique({ where: { id: imageId } });
  if (!image) return new NextResponse("Not Found", { status: 404 });

  // Rows are never updated (a new photo is a new id), so the id is a perfect ETag.
  const etag = `"guide-${image.id}"`;
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
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
