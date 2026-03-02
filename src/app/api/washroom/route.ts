import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const CLEANING_INTERVAL_DAYS = 14;

// GET washroom cleaning records + stats + next due date
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

  // Get cleanings for the selected month
  const cleanings = await prisma.washroomCleaning.findMany({
    where: { date: { gte: startDate, lte: endDate }, messId },
    include: { member: { select: { id: true, name: true } } },
    orderBy: [{ date: "desc" }, { washroomNumber: "asc" }],
  });

  // Yearly stats: how many times each member has cleaned
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const yearlyCleanings = await prisma.washroomCleaning.findMany({
    where: { messId, date: { gte: yearStart, lte: yearEnd } },
    select: { memberId: true },
  });

  const yearlyStats: Record<string, number> = {};
  for (const c of yearlyCleanings) {
    yearlyStats[c.memberId] = (yearlyStats[c.memberId] || 0) + 1;
  }

  const members = await prisma.user.findMany({
    where: { messId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Calculate next due date for each washroom (last cleaning + 14 days)
  const nextDueDates: Record<number, string | null> = {};
  for (let wn = 1; wn <= mess.washroomCount; wn++) {
    const lastCleaning = await prisma.washroomCleaning.findFirst({
      where: { messId, washroomNumber: wn },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    if (lastCleaning) {
      const next = new Date(lastCleaning.date);
      next.setDate(next.getDate() + CLEANING_INTERVAL_DAYS);
      nextDueDates[wn] = next.toISOString().split("T")[0];
    } else {
      nextDueDates[wn] = null; // Never cleaned
    }
  }

  return NextResponse.json({
    cleanings,
    members,
    washroomCount: mess.washroomCount,
    yearlyStats,
    nextDueDates,
    intervalDays: CLEANING_INTERVAL_DAYS,
  });
}

// POST - Manager logs a washroom cleaning (who cleaned which washroom on what date)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Only manager can log cleanings" }, { status: 403 });
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
  const { date, washroomNumber, memberId, note } = body;

  if (!date || !washroomNumber || !memberId) {
    return NextResponse.json({ error: "date, washroomNumber, and memberId are required" }, { status: 400 });
  }

  if (washroomNumber < 1 || washroomNumber > mess.washroomCount) {
    return NextResponse.json({ error: `Washroom number must be between 1 and ${mess.washroomCount}` }, { status: 400 });
  }

  const dateObj = new Date(date);

  const cleaning = await prisma.washroomCleaning.create({
    data: {
      date: dateObj,
      washroomNumber,
      memberId,
      messId,
      status: "DONE",
      note: note || null,
    },
    include: { member: { select: { id: true, name: true } } },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      editedById: session.user.id,
      messId,
      tableName: "WashroomCleaning",
      recordId: cleaning.id,
      fieldName: "cleaning",
      newValue: `WR-${washroomNumber} cleaned by ${cleaning.member.name} on ${date}`,
      action: "CREATE",
    },
  });

  return NextResponse.json({ success: true, cleaning });
}

// DELETE - Delete a cleaning record (manager only)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "MANAGER" || !session.user.messId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const messId = session.user.messId;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const cleaning = await prisma.washroomCleaning.findUnique({ where: { id } });
  if (!cleaning || cleaning.messId !== messId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.washroomCleaning.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
