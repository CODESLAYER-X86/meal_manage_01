import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth, isAllowedAdminEmail } from "@/lib/auth";

// Helper: check if session user is admin or officer
function hasAdminAccess(session: any): boolean {
  return session?.user?.isAdmin || session?.user?.isOfficer;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const search = searchParams.get("search") || "";
  const limit = 20;

  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] }
    : {};

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          isAdmin: true, isOfficer: true, isActive: true, messId: true, createdAt: true,
          mess: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);
    return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch {
    // Fallback: isOfficer column may not exist yet (run /api/db-sync)
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
    const usersWithOfficer = users.map((u: any) => ({ ...u, isOfficer: false }));
    return NextResponse.json({ users: usersWithOfficer, total, page, pages: Math.ceil(total / limit) });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const isAdmin = (session.user as any).isAdmin;
  const isOfficer = (session.user as any).isOfficer && !isAdmin;

  const { id, action } = await request.json();
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  // Fetch target user to check their status
  let target: { isAdmin: boolean; isOfficer: boolean; email: string } | null;
  try {
    target = await prisma.user.findUnique({
      where: { id },
      select: { isAdmin: true, isOfficer: true, email: true },
    });
  } catch {
    const t = await prisma.user.findUnique({
      where: { id },
      select: { isAdmin: true, email: true },
    });
    target = t ? { ...t, isOfficer: false } : null;
  }
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // RULE: Admins are UNTOUCHABLE — no one can deactivate/kick/delete them
  // (Except: an admin removing another admin's admin status is handled specially below)
  if (target.isAdmin && ["deactivate", "kickFromMess"].includes(action)) {
    return NextResponse.json({ error: "Cannot perform this action on a Platform Admin." }, { status: 403 });
  }

  // RULE: Officers cannot touch admins at all
  if (isOfficer && target.isAdmin) {
    return NextResponse.json({ error: "Officers cannot modify Platform Admins." }, { status: 403 });
  }

  // RULE: Officers cannot touch other officers (only admins can manage officers)
  if (isOfficer && target.isOfficer && id !== session.user.id) {
    return NextResponse.json({ error: "Only admins can manage officers." }, { status: 403 });
  }

  // Don't let anyone act on themselves for destructive actions
  if (id === session.user.id && ["deactivate", "kickFromMess", "removeOfficer"].includes(action)) {
    return NextResponse.json({ error: "Cannot perform this action on yourself" }, { status: 400 });
  }

  if (action === "deactivate") {
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  }

  if (action === "activate") {
    await prisma.user.update({ where: { id }, data: { isActive: true } });
    return NextResponse.json({ success: true });
  }

  // OFFICER MANAGEMENT — Only admins (not officers) can do these
  if (action === "makeOfficer") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Only Platform Admins can create officers." }, { status: 403 });
    }
    if (target.isAdmin) {
      return NextResponse.json({ error: "Admins don't need officer status." }, { status: 400 });
    }
    await prisma.user.update({ where: { id }, data: { isOfficer: true } });
    return NextResponse.json({ success: true });
  }

  if (action === "removeOfficer") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Only Platform Admins can demote officers." }, { status: 403 });
    }
    await prisma.user.update({ where: { id }, data: { isOfficer: false } });
    return NextResponse.json({ success: true });
  }

  if (action === "kickFromMess") {
    await prisma.user.update({ where: { id }, data: { messId: null, role: "MEMBER" } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const isAdmin = (session.user as any).isAdmin;
  const isOfficer = (session.user as any).isOfficer && !isAdmin;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Prevent deleting yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  // Fetch target
  let target: { isAdmin: boolean; isOfficer: boolean } | null;
  try {
    target = await prisma.user.findUnique({
      where: { id },
      select: { isAdmin: true, isOfficer: true },
    });
  } catch {
    const t = await prisma.user.findUnique({
      where: { id },
      select: { isAdmin: true },
    });
    target = t ? { ...t, isOfficer: false } : null;
  }
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Admins cannot be deleted
  if (target.isAdmin) {
    return NextResponse.json({ error: "Platform Admins cannot be deleted." }, { status: 403 });
  }

  // Officers can't delete other officers
  if (isOfficer && target.isOfficer) {
    return NextResponse.json({ error: "Officers cannot delete other officers." }, { status: 403 });
  }

  // Delete all related records, then the user
  try {
    await prisma.$transaction([
      prisma.mealEntry.deleteMany({ where: { memberId: id } }),
      prisma.deposit.deleteMany({ where: { memberId: id } }),
      prisma.mealRating.deleteMany({ where: { memberId: id } }),
      prisma.mealOffRequest.deleteMany({ where: { memberId: id } }),
      prisma.mealStatus.deleteMany({ where: { memberId: id } }),
      prisma.mealStatusRequest.deleteMany({ where: { memberId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.washroomCleaning.deleteMany({ where: { memberId: id } }),
      prisma.billPayment.deleteMany({ where: { memberId: id } }),
      prisma.fine.deleteMany({ where: { memberId: id } }),
      prisma.mealVote.deleteMany({ where: { voterId: id } }),
      prisma.memberPresence.deleteMany({ where: { memberId: id } }),
      prisma.auditLog.deleteMany({ where: { editedById: id } }),
      prisma.user.delete({ where: { id } }),
    ]);
  } catch (e: unknown) {
    return NextResponse.json({ error: `Failed to delete user: ${(e as Error).message}` }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
