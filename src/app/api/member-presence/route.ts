import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET presence status for all members
export async function GET() {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const presences = await prisma.memberPresence.findMany({
    where: { messId },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { member: { name: "asc" } },
  });

  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ presences, members });
}

// PATCH - Toggle own presence or manager sets for member
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { memberId, isAway, awayFrom, awayUntil, reason } = body;

  // Members can only toggle their own; managers can toggle anyone
  const targetId = memberId || session.user.id;
  if (session.user.role !== "MANAGER" && targetId !== session.user.id) {
    return NextResponse.json(
      { error: "You can only update your own presence" },
      { status: 403 }
    );
  }

  // Verify target is in the same mess
  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
    select: { messId: true },
  });
  if (targetUser?.messId !== messId) {
    return NextResponse.json({ error: "Member not in your mess" }, { status: 400 });
  }

  const presence = await prisma.memberPresence.upsert({
    where: { memberId_messId: { memberId: targetId, messId } },
    create: {
      memberId: targetId,
      messId,
      isAway: isAway ?? false,
      awayFrom: awayFrom ? new Date(awayFrom) : null,
      awayUntil: awayUntil ? new Date(awayUntil) : null,
      reason: reason || null,
    },
    update: {
      isAway: isAway ?? false,
      awayFrom: awayFrom ? new Date(awayFrom) : null,
      awayUntil: awayUntil ? new Date(awayUntil) : null,
      reason: reason || null,
      updatedAt: new Date(),
    },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId,
      tableName: "MemberPresence",
      recordId: presence.id,
      fieldName: "isAway",
      newValue: String(isAway),
      action: "UPDATE",
    },
  });

  return NextResponse.json({ success: true, presence });
}
