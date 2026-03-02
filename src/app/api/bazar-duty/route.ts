import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET bazar duties for a month + yearly stats
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") || new Date().getFullYear());

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const duties = await prisma.bazarDuty.findMany({
    where: { messId, date: { gte: startDate, lte: endDate } },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Yearly stats for fair assignment tracking
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const yearlyDuties = await prisma.bazarDuty.findMany({
    where: { messId, date: { gte: yearStart, lte: yearEnd } },
    select: { memberId: true, status: true },
  });

  const yearlyStats: Record<string, { assigned: number; done: number }> = {};
  for (const d of yearlyDuties) {
    if (!yearlyStats[d.memberId]) yearlyStats[d.memberId] = { assigned: 0, done: 0 };
    yearlyStats[d.memberId].assigned++;
    if (d.status === "DONE") yearlyStats[d.memberId].done++;
  }

  return NextResponse.json({ duties, members, yearlyStats });
}

// POST - Manager manually assigns a bazar duty on a specific date
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const body = await request.json();
  const { date, memberId } = body;

  if (!date || !memberId) {
    return NextResponse.json({ error: "date and memberId are required" }, { status: 400 });
  }

  const dateObj = new Date(date);

  // Check if already assigned for this date
  const existing = await prisma.bazarDuty.findFirst({
    where: { messId, date: dateObj },
  });
  if (existing) {
    return NextResponse.json({ error: "A bazar duty is already assigned for this date. Delete it first or reassign." }, { status: 400 });
  }

  const duty = await prisma.bazarDuty.create({
    data: { date: dateObj, memberId, messId },
    include: { member: { select: { id: true, name: true } } },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId,
      tableName: "BazarDuty",
      recordId: duty.id,
      fieldName: "assignment",
      newValue: `Bazar duty on ${date} assigned to ${duty.member.name}`,
      action: "CREATE",
    },
  });

  return NextResponse.json({ success: true, duty });
}

// PATCH - Update a bazar duty (mark done, reassign)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }

  const duty = await prisma.bazarDuty.findUnique({ where: { id } });
  if (!duty || duty.messId !== session.user.messId) {
    return NextResponse.json({ error: "Duty not found" }, { status: 404 });
  }

  const messId = session.user.messId;
  const isManager = session.user.role === "MANAGER";

  if (action === "done") {
    if (!isManager && duty.memberId !== session.user.id) {
      return NextResponse.json({ error: "You can only mark your own duties" }, { status: 403 });
    }
    const updated = await prisma.bazarDuty.update({
      where: { id },
      data: { status: "DONE", updatedAt: new Date() },
    });
    return NextResponse.json({ success: true, duty: updated });
  }

  if (action === "reassign") {
    if (!isManager) {
      return NextResponse.json({ error: "Only manager can reassign" }, { status: 403 });
    }
    const { newMemberId, reason } = body;
    if (!newMemberId) {
      return NextResponse.json({ error: "newMemberId is required" }, { status: 400 });
    }

    const originalMemberId = duty.originalMemberId || duty.memberId;

    const updated = await prisma.bazarDuty.update({
      where: { id },
      data: { memberId: newMemberId, originalMemberId, note: reason || null, updatedAt: new Date() },
      include: { member: { select: { id: true, name: true } } },
    });

    await prisma.dutyDebt.create({
      data: {
        owedById: originalMemberId,
        owedToId: newMemberId,
        messId,
        dutyType: "BAZAR",
        reason: reason || `Bazar duty reassigned for ${duty.date.toISOString().split("T")[0]}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        editedById: session.user.id,
        messId,
        tableName: "BazarDuty",
        recordId: id,
        fieldName: "memberId",
        oldValue: duty.memberId,
        newValue: newMemberId,
        action: "REASSIGN",
      },
    });

    return NextResponse.json({ success: true, duty: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// DELETE - Delete a single duty or entire month's duties (manager only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId || session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  // Delete single duty
  if (id) {
    const duty = await prisma.bazarDuty.findUnique({ where: { id } });
    if (!duty || duty.messId !== session.user.messId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.bazarDuty.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: 1 });
  }

  // Delete entire month
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));
  if (!month || !year) {
    return NextResponse.json({ error: "id, or month and year required" }, { status: 400 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const result = await prisma.bazarDuty.deleteMany({
    where: { messId: session.user.messId, date: { gte: startDate, lte: endDate } },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
