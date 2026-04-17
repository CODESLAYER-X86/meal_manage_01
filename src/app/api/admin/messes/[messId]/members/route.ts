import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messId: string }> }
) {
  const session = await auth();
  if (!session?.user || !(session.user.isAdmin || session.user.isOfficer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { messId } = await params;

  const members = await prisma.user.findMany({
    where: { messId },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ members });
}
