import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = 20;

  const [messes, total] = await Promise.all([
    prisma.mess.findMany({
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, mealEntries: true, deposits: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mess.count(),
  ]);

  return NextResponse.json({ messes, total, page, pages: Math.ceil(total / limit) });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Remove all members from mess first
  await prisma.user.updateMany({
    where: { messId: id },
    data: { messId: null, role: "MEMBER" },
  });

  // Delete the mess (cascade will handle related records if configured)
  await prisma.mess.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
