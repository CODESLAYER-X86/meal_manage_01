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
  const search = searchParams.get("search") || "";
  const limit = 20;

  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        isAdmin: true, isActive: true, messId: true, createdAt: true,
        mess: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id, action } = await request.json();
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  if (action === "deactivate") {
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  }

  if (action === "activate") {
    await prisma.user.update({ where: { id }, data: { isActive: true } });
    return NextResponse.json({ success: true });
  }

  if (action === "makeAdmin") {
    await prisma.user.update({ where: { id }, data: { isAdmin: true } });
    return NextResponse.json({ success: true });
  }

  if (action === "removeAdmin") {
    // Don't let admin remove their own admin status
    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot remove your own admin status" }, { status: 400 });
    }
    await prisma.user.update({ where: { id }, data: { isAdmin: false } });
    return NextResponse.json({ success: true });
  }

  if (action === "kickFromMess") {
    await prisma.user.update({ where: { id }, data: { messId: null, role: "MEMBER" } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
