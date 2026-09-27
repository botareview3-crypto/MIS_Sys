import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadDeviceForRole } from "@/lib/devices";
import { RECENTLY_VIEWED_COOKIE, withRecentlyViewed } from "@/lib/recently-viewed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<{ id: string }> };

/**
 * Fire-and-forget: called once (client-side, on mount) whenever the device
 * detail page is viewed, to power the dashboard's "Recently viewed"
 * section (item 8). Any authenticated role can hit this — it just records
 * *their own* browsing, nothing visible to anyone else. Silently no-ops
 * (200, cookie untouched) for a device id the viewer can't actually see,
 * via the same `loadDeviceForRole` scoping every other device read uses,
 * so a Secondary Admin's cookie can never end up pointing at a job that
 * isn't theirs.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isInteger(deviceId) || deviceId < 1) {
    return NextResponse.json({ error: "Invalid device record." }, { status: 400 });
  }

  const device = await loadDeviceForRole(deviceId, session);
  if (!device) {
    return NextResponse.json({ ok: true });
  }

  const existing = req.cookies.get(RECENTLY_VIEWED_COOKIE)?.value;
  const updated = withRecentlyViewed(existing, deviceId);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(RECENTLY_VIEWED_COOKIE, JSON.stringify(updated), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
