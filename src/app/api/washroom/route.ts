import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Fixed cleaning dates each month
const CLEANING_DAYS = [1, 15, 29];

// GET washroom cleaning schedule for a month + yearly stats
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { washroomCount: true },
  });

  if (!mess || mess.washroomCount === 0) {
    return NextResponse.json({ error: "Washroom cleaning is not enabled for this mess", disabled: true }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const duties = await prisma.washroomCleaning.findMany({
    where: { date: { gte: startDate, lte: endDate }, messId },
    include: { member: { select: { id: true, name: true } } },
    orderBy: [{ date: "asc" }, { washroomNumber: "asc" }],
  });

  // Yearly stats: how many times each member has been assigned this year
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const yearlyDuties = await prisma.washroomCleaning.findMany({
    where: { messId, date: { gte: yearStart, lte: yearEnd } },
    select: { memberId: true, status: true },
  });

  const yearlyStats: Record<string, { assigned: number; done: number }> = {};
  for (const d of yearlyDuties) {
    if (!yearlyStats[d.memberId]) yearlyStats[d.memberId] = { assigned: 0, done: 0 };
    yearlyStats[d.memberId].assigned++;
    if (d.status === "DONE") yearlyStats[d.memberId].done++;
  }

  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    duties,
    members,
    washroomCount: mess.washroomCount,
    cleaningDays: CLEANING_DAYS,
    yearlyStats,
  });
}

// POST - Manager manually assigns a member to a washroom on a specific date
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const mess = await prisma.mess.findUnique({
    where: { id: messId },
    select: { washroomCount: true },
  });
  if (!mess || mess.washroomCount === 0) {
    return NextResponse.json({ error: "Washroom cleaning is not enabled" }, { status: 400 });
  }

  const body = await request.json();
  const { date, washroomNumber, memberId } = body;

  if (!date || !washroomNumber || !memberId) {
    return NextResponse.json({ error: "date, washroomNumber, and memberId are required" }, { status: 400 });
  }

  const dateObj = new Date(date);
  const day = dateObj.getDate();
  if (!CLEANING_DAYS.includes(day)) {
    return NextResponse.json({ error: `Cleaning is only allowed on dates: ${CLEANING_DAYS.join(", ")}` }, { status: 400 });
  }

  if (washroomNumber < 1 || washroomNumber > mess.washroomCount) {
    return NextResponse.json({ error: `Washroom number must be between 1 and ${mess.washroomCount}` }, { status: 400 });
  }

  // Check if this slot is already assigned
  const existing = await prisma.washroomCleaning.findFirst({
    where: { date: dateObj, washroomNumber, messId },
  });
  if (existing) {
    return NextResponse.json({ error: "This washroom slot is already assigned. Delete it first or reassign." }, { status: 400 });
  }

  const duty = await prisma.washroomCleaning.create({
    data: { date: dateObj, washroomNumber, memberId, messId },
    include: { member: { select: { id: true, name: true } } },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId,
      tableName: "WashroomCleaning",
      recordId: duty.id,
      fieldName: "assignment",
      newValue: `WR-${washroomNumber} on ${date} assigned to ${duty.member.name}`,
      action: "CREATE",
    },
  });

  return NextResponse.json({ success: true, duty });
}

// PATCH - Mark duty done/skipped, manager confirm, or reassign
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, action, status, newMemberId, reason } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const duty = await prisma.washroomCleaning.findUnique({ where: { id } });
  if (!duty || duty.messId !== session.user.messId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isManager = session.user.role === "MANAGER";
  const messId = session.user.messId;

  // Action: "confirm" - Manager confirms a completed duty
  if (action === "confirm") {
    if (!isManager) {
      return NextResponse.json({ error: "Only manager can confirm" }, { status: 403 });
    }
    const updated = await prisma.washroomCleaning.update({
      where: { id },
      data: { confirmedByManager: true, completedAt: new Date() },
    });
    return NextResponse.json({ success: true, duty: updated });
  }

  // Action: "reassign" - Manager reassigns to another member (creates debt)
  if (action === "reassign") {
    if (!isManager) {
      return NextResponse.json({ error: "Only manager can reassign" }, { status: 403 });
    }
    if (!newMemberId) {
      return NextResponse.json({ error: "newMemberId is required" }, { status: 400 });
    }

    const originalMemberId = duty.originalMemberId || duty.memberId;

    const updated = await prisma.washroomCleaning.update({
      where: { id },
      data: { memberId: newMemberId, originalMemberId, note: reason || null },
      include: { member: { select: { id: true, name: true } } },
    });

    await prisma.dutyDebt.create({
      data: {
        owedById: originalMemberId,
        owedToId: newMemberId,
        messId,
        dutyType: "WASHROOM",
        reason: reason || `Washroom duty reassigned for ${duty.date.toISOString().split("T")[0]} (WC#${duty.washroomNumber})`,
      },
    });

    await prisma.auditLog.create({
      data: {
        editedById: session.user.id,
        messId,
        tableName: "WashroomCleaning",
        recordId: id,
        fieldName: "memberId",
        oldValue: duty.memberId,
        newValue: newMemberId,
        action: "REASSIGN",
      },
    });

    return NextResponse.json({ success: true, duty: updated });
  }

  // Default: mark status (DONE/SKIPPED/PENDING)
  if (!status) {
    return NextResponse.json({ error: "status or action is required" }, { status: 400 });
  }

  if (!isManager && duty.memberId !== session.user.id) {
    return NextResponse.json({ error: "You can only update your own duties" }, { status: 403 });
  }

  const updated = await prisma.washroomCleaning.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });

  return NextResponse.json({ success: true, duty: updated });
}

// DELETE - Delete a single duty or entire month's schedule (manager only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  // Delete single duty
  if (id) {
    const duty = await prisma.washroomCleaning.findUnique({ where: { id } });
    if (!duty || duty.messId !== messId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.washroomCleaning.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: 1 });
  }

  // Delete entire month
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));
  if (!month || !year) {
    return NextResponse.json({ error: "id, or month and year are required" }, { status: 400 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const result = await prisma.washroomCleaning.deleteMany({
    where: { date: { gte: startDate, lte: endDate }, messId },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
