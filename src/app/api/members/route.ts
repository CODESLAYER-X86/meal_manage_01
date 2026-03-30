import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all members in the same mess
export async function GET() {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }

  const members = await prisma.user.findMany({
    where: { isActive: true, messId: session.user.messId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      joinDate: true,
      leaveDate: true,
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(members);
}
