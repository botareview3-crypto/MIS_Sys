import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRoles, apiAuthErrorResponse } from "@/lib/api-auth";

// Backs the "returning customer" autocomplete on the Register Device form.
// Never returns outlookPasswordEncrypted — the form can't and shouldn't
// prefill a stored password, just the identifying/contact fields.
export async function GET(req: NextRequest) {
  try {
    await requireApiRoles(["Admin", "Reception", "Technician"]);
  } catch (e) {
    const authError = apiAuthErrorResponse(e);
    if (authError) return authError;
    throw e;
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    return NextResponse.json({ customers: [] });
  }

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phoneNumber: { contains: q, mode: "insensitive" } },
        { outlookEmail: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      fullName: true,
      phoneNumber: true,
      outlookEmail: true,
      regionalOffice: true,
    },
  });

  return NextResponse.json({ customers });
}
