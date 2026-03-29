import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !((session.user as any).isAdmin || (session.user as any).isOfficer)) {
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
  if (!session?.user || !((session.user as any).isAdmin || (session.user as any).isOfficer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Remove all members from mess first
  await prisma.user.updateMany({
    where: { messId: id },
    data: { messId: null, role: "MEMBER" },
  });

  // Delete all related records in dependency order to avoid FK constraint errors
  try {
    // Get IDs for cascade
    const tripIds = (await prisma.bazarTrip.findMany({ where: { messId: id }, select: { id: true } })).map(t => t.id);
    const topicIds = (await prisma.mealVoteTopic.findMany({ where: { messId: id }, select: { id: true } })).map(t => t.id);

    await prisma.$transaction([
      // Child records first
      ...(tripIds.length > 0 ? [prisma.bazarItem.deleteMany({ where: { tripId: { in: tripIds } } })] : []),
      ...(topicIds.length > 0 ? [prisma.mealVote.deleteMany({ where: { topicId: { in: topicIds } } })] : []),
      prisma.mealVoteTopic.deleteMany({ where: { messId: id } }),
      prisma.bazarTrip.deleteMany({ where: { messId: id } }),
      prisma.mealEntry.deleteMany({ where: { messId: id } }),
      prisma.deposit.deleteMany({ where: { messId: id } }),
      prisma.mealPlan.deleteMany({ where: { messId: id } }),
      prisma.mealRating.deleteMany({ where: { messId: id } }),
      prisma.mealOffRequest.deleteMany({ where: { messId: id } }),
      prisma.mealStatus.deleteMany({ where: { messId: id } }),
      prisma.mealStatusRequest.deleteMany({ where: { messId: id } }),
      prisma.announcement.deleteMany({ where: { messId: id } }),
      prisma.auditLog.deleteMany({ where: { messId: id } }),
      prisma.notification.deleteMany({ where: { messId: id } }),
      prisma.washroomCleaning.deleteMany({ where: { messId: id } }),
      prisma.washroomDutySchedule.deleteMany({ where: { messId: id } }),
      prisma.bazarDutySchedule.deleteMany({ where: { messId: id } }),
      prisma.managerRotation.deleteMany({ where: { messId: id } }),
      prisma.billPayment.deleteMany({ where: { messId: id } }),
      prisma.billSetting.deleteMany({ where: { messId: id } }),
      prisma.fine.deleteMany({ where: { messId: id } }),
      prisma.joinRequest.deleteMany({ where: { messId: id } }),
      prisma.dutySwapRequest.deleteMany({ where: { messId: id } }),
      prisma.dispute.deleteMany({ where: { messId: id } }),
      prisma.memberPresence.deleteMany({ where: { messId: id } }),
      // Finally delete the mess
      prisma.mess.delete({ where: { id } }),
    ]);
  } catch (e: unknown) {
    return NextResponse.json({ error: `Failed to delete mess: ${(e as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !((session.user as any).isAdmin || (session.user as any).isOfficer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { messId, newManagerId } = await request.json();
  if (!messId || !newManagerId) {
    return NextResponse.json({ error: "messId and newManagerId are required" }, { status: 400 });
  }

  // Verify the new manager is actually in this mess
  const newManager = await prisma.user.findFirst({
    where: { id: newManagerId, messId },
  });
  if (!newManager) {
    return NextResponse.json({ error: "User is not a member of this mess" }, { status: 400 });
  }

  // Demote current manager(s) to MEMBER, then promote the new one
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { messId, role: "MANAGER" },
      data: { role: "MEMBER" },
    }),
    prisma.user.update({
      where: { id: newManagerId },
      data: { role: "MANAGER" },
    }),
  ]);

  return NextResponse.json({ success: true });
}
